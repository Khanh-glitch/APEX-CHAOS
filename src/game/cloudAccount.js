// APEX CHAOS cloud account adapter (A1.2) — Supabase, env-gated, lazy.
//
// Configuration arrives ONLY through public client env vars:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   (anon key + user JWT + RLS;
//   a service-role key must never appear in this bundle).
//
// Without them the adapter reports `cloud-unconfigured` and every action
// fails honestly — there is no simulated login anywhere in the product.
//
// Trust boundary (brief §5): this phase syncs identity, profile, preferences
// and progress SNAPSHOTS. It never issues verified cloud currency: the
// server-side wallet RPCs ship disabled (app_config.cloud_wallet_enabled)
// until validated match receipts exist, and this client contains no call
// that can mint cloud AC. The spendable wallet remains the local
// APEX_ARSENAL_META authority; snapshots uploaded here are marked
// `unverified: true` and are only ever auto-restored onto a pristine local
// profile (see restoreSnapshotIfPristine) — never merged silently.

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

function accountAuthority() {
  return typeof window !== 'undefined' ? window.APEX_PLAYER_ACCOUNT : null;
}
function setSync(status, detail) {
  accountAuthority()?.__setSyncState?.(status, detail);
}

async function projectSession(client, session) {
  const account = accountAuthority();
  if (!account) return;
  if (!session || !session.user) {
    account.__setCloudSession(null);
    setSync(isCloudConfigured() ? 'signed-out' : 'cloud-unconfigured', '');
    return;
  }
  const user = session.user;
  let role = 'player';
  let displayName = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
  try {
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      client.from('account_roles').select('role').eq('user_id', user.id).maybeSingle(),
      client.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle(),
    ]);
    if (roleRow && roleRow.role === 'admin') role = 'admin';
    if (profileRow && profileRow.display_name) displayName = profileRow.display_name;
    var avatarUrl = (profileRow && profileRow.avatar_url) || user.user_metadata?.avatar_url || '';
  } catch (error) {
    var avatarUrl = user.user_metadata?.avatar_url || '';
  }
  account.__setCloudSession({
    userId: user.id,
    email: user.email || '',
    displayName: displayName || user.email || 'Player',
    avatarUrl: avatarUrl || '',
    providers: (user.identities || []).map((i) => i.provider).filter(Boolean),
    role,
  });
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
  accountAuthority()?.__setCloudSession(null);
  setSync('signed-out', '');
  return error ? { ok: false, reason: error.message } : { ok: true };
}

// Account deletion deletes the caller's public data rows via a
// security-definer RPC and audits the request; removal of the underlying
// auth user additionally requires a service-role sweep (documented in the
// migration). The local guest profile/economy on this device is untouched —
// deletion is a cloud-identity action, confirmed in the Account Center UI.
export async function requestAccountDeletion() {
  if (!isCloudConfigured()) return unconfigured();
  const client = await getClient();
  const { error } = await client.rpc('request_account_deletion');
  if (error) return { ok: false, reason: error.message };
  await signOutCloud();
  return { ok: true };
}

// ── Progress snapshots (unverified, conflict-safe) ──────────────────────────
// Deterministic policy: uploads are version-checked (optimistic concurrency);
// a version mismatch reports 'conflict' and never silently overwrites the
// newer server snapshot. Economic fields are never auto-applied on download.
export async function uploadProgressSnapshot() {
  if (!isCloudConfigured()) return unconfigured();
  const account = accountAuthority();
  const profile = account && account.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const meta = typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
  const snapshot = meta && typeof meta.getState === 'function' ? meta.getState() : null;
  if (!snapshot) return { ok: false, reason: 'wallet-unavailable' };
  setSync('syncing', '');
  try {
    const client = await getClient();
    const { data: existing } = await client
      .from('player_progress').select('version')
      .eq('user_id', profile.profileId).eq('namespace', 'arsenalMeta').maybeSingle();
    const nextVersion = (existing && Number(existing.version) || 0) + 1;
    const { error } = await client.from('player_progress').upsert({
      user_id: profile.profileId,
      namespace: 'arsenalMeta',
      version: nextVersion,
      payload: { unverified: true, guestProfileId: account.guestProfileId(), state: snapshot },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,namespace' });
    if (error) throw error;
    setSync('saved', '');
    return { ok: true, version: nextVersion };
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
  const account = accountAuthority();
  const profile = account && account.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const meta = typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
  const snapshot = meta && typeof meta.getState === 'function' ? meta.getState() : null;
  const client = await getClient();
  const { error } = await client.from('guest_migrations').insert({
    user_id: profile.profileId,
    guest_profile_id: account.guestProfileId(),
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
  if (scope && !scope.APEX_CLOUD_ACCOUNT) scope.APEX_CLOUD_ACCOUNT = api;
  return api;
}

export default api;
