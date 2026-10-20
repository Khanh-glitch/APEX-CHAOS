// APEX CHAOS player account — identity/session projection authority (A1).
//
// This module owns WHO the player appears to be on this device: a persistent
// local guest profile today, and the cloud session projection when Supabase
// is configured (src/game/cloudAccount.js feeds authenticated sessions
// through the module-private functions at the bottom of this file). It
// deliberately does NOT own credits, ownership or progression arithmetic —
// the wallet authority remains APEX_ARSENAL_META
// (public/game/arsenal/arsenalMetaRuntime.js).
//
// SECURITY (A1 closeout, Blocker 1): the profile projection is DISPLAY
// STATE ONLY. It is not, and must never become, authorization evidence:
//   * The projection carries no role. Admin derivation lives in
//     src/game/adminAuthority.js and reads only its own server-verified
//     channel — never this profile.
//   * The session/sync setters are ES-module-private functions imported
//     solely by cloudAccount.js. They are NOT attached to the frozen
//     window authority, so a console user cannot call them to forge a
//     cloud identity (the pre-closeout build exposed exactly that and a
//     guest could self-grant admin — regression-tested by
//     tools/testAdminEscalationNegativesBrowser.mjs).
//   * The window binding itself is installed non-writable +
//     non-configurable, so the genuine authority object cannot be swapped
//     out from under its consumers.
// A user with full devtools control can still rewrite their own client's
// behavior (accepted device-local boundary); nothing here can mint server
// rights or cloud assets — those live behind Supabase Auth + RLS + RPCs.
//
// Trust law: a local guest profile is a device identity, not a trusted
// cloud identity. The stored guest record carries no role field, and any
// role/kind fields forged into storage are ignored on load.

const STORAGE_KEY = 'apexChaos.playerAccount.v1';

function makeProfileId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (error) {}
  return 'guest-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

function guestTag(profileId) {
  let hash = 0;
  for (let i = 0; i < profileId.length; i += 1) {
    hash = ((hash * 31) + profileId.charCodeAt(i)) >>> 0;
  }
  return String(hash % 10000).padStart(4, '0');
}

function loadGuestProfile() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (error) {}
  if (raw && typeof raw === 'object' && typeof raw.profileId === 'string' && raw.profileId) {
    return {
      kind: 'guest',
      profileId: raw.profileId,
      displayName: typeof raw.displayName === 'string' && raw.displayName.trim()
        ? raw.displayName.slice(0, 24) : null,
      createdAt: Number(raw.createdAt) || Date.now(),
    };
  }
  const fresh = { kind: 'guest', profileId: makeProfileId(), displayName: null, createdAt: Date.now() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (error) {}
  return fresh;
}

let guestProfile = loadGuestProfile();
let cloudSession = null; // { userId, email, displayName, avatarUrl, providers[] } — display only, NO role
let syncState = { status: 'local-only', lastSyncAt: null, detail: '' };

function emitAccountChange() {
  try {
    window.dispatchEvent(new CustomEvent('apex:account', {
      detail: { profile: publicProfile(), sync: { ...syncState } },
    }));
  } catch (error) {}
}

function publicProfile() {
  // Display projection only. There is intentionally NO role field: any
  // consumer that needs authorization must ask the Admin authority.
  if (cloudSession) {
    return Object.freeze({
      kind: 'cloud',
      profileId: cloudSession.userId,
      displayName: cloudSession.displayName || cloudSession.email || 'Player',
      email: cloudSession.email || '',
      avatarUrl: cloudSession.avatarUrl || '',
      providers: [...(cloudSession.providers || [])],
      guestProfileId: guestProfile.profileId,
      createdAt: guestProfile.createdAt,
    });
  }
  return Object.freeze({
    kind: 'guest',
    profileId: guestProfile.profileId,
    displayName: guestProfile.displayName || `GUEST-${guestTag(guestProfile.profileId)}`,
    email: '',
    avatarUrl: '',
    providers: [],
    guestProfileId: guestProfile.profileId,
    createdAt: guestProfile.createdAt,
  });
}

const authority = Object.freeze({
  version: 'a1-player-account-v1',
  profile: publicProfile,
  isGuest: () => !cloudSession,
  guestProfileId: () => guestProfile.profileId,
  syncStatus: () => Object.freeze({ ...syncState }),
  setDisplayName(name) {
    const clean = String(name || '').trim().slice(0, 24);
    if (!clean) return publicProfile();
    if (cloudSession) {
      cloudSession = { ...cloudSession, displayName: clean };
    } else {
      guestProfile = { ...guestProfile, displayName: clean };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(guestProfile)); } catch (error) {}
    }
    emitAccountChange();
    return publicProfile();
  },
});

export function installPlayerAccountAuthority(scope = globalThis) {
  const current = scope && scope.APEX_PLAYER_ACCOUNT;
  if (current && current.version === 'a1-player-account-v1') return current;
  if (scope) {
    // Lock the binding: consumers across classic-script runtimes read this
    // authority through window, so the genuine object must not be
    // swappable from the console or another script.
    try {
      Object.defineProperty(scope, 'APEX_PLAYER_ACCOUNT', {
        value: authority, writable: false, configurable: false, enumerable: true,
      });
    } catch (error) {
      try { scope.APEX_PLAYER_ACCOUNT = authority; } catch (ignored) {}
    }
  }
  return authority;
}

if (typeof window !== 'undefined') installPlayerAccountAuthority(window);

export default authority;

// ── Module-private cloud feed ───────────────────────────────────────────────
// Imported ONLY by src/game/cloudAccount.js, which calls them after a real
// Supabase session exists. These are deliberately ES-module exports that
// are never attached to window or to the frozen authority object: module
// scope is not reachable from the devtools console, so a guest cannot
// invoke them to forge a cloud identity (A1 closeout Blocker 1). Do not
// re-export them through any window global.
export function projectCloudSessionInternal(session) {
  cloudSession = session && session.userId ? { ...session } : null;
  emitAccountChange();
}

export function setCloudSyncStateInternal(status, detail) {
  syncState = {
    status: String(status || 'local-only'),
    lastSyncAt: status === 'saved' ? Date.now() : syncState.lastSyncAt,
    detail: String(detail || ''),
  };
  emitAccountChange();
}
