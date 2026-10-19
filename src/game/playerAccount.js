// APEX CHAOS player account — identity/session projection authority (A1).
//
// This module owns WHO the player is on this device: a persistent local guest
// profile today, and the cloud session projection when Supabase is configured
// (src/game/cloudAccount.js feeds authenticated sessions through the internal
// seam below). It deliberately does NOT own credits, ownership or progression
// arithmetic — the wallet authority remains APEX_ARSENAL_META
// (public/game/arsenal/arsenalMetaRuntime.js). Account Center and the Admin
// authority read identity/role from here; nothing else may invent a parallel
// "current user" state.
//
// Trust law: a local guest profile is a device identity, not a trusted cloud
// identity. Role claims ('admin') are accepted ONLY from an authenticated
// cloud session object installed by the cloud adapter after server-side
// verification — never from localStorage, query params or console writes to
// this module's storage key (the stored guest record carries no role field,
// and any role field found in storage is ignored on load).

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
let cloudSession = null; // { userId, email, displayName, avatarUrl, providers[], role }
let syncState = { status: 'local-only', lastSyncAt: null, detail: '' };

function emitAccountChange() {
  try {
    window.dispatchEvent(new CustomEvent('apex:account', {
      detail: { profile: publicProfile(), sync: { ...syncState } },
    }));
  } catch (error) {}
}

function publicProfile() {
  if (cloudSession) {
    return Object.freeze({
      kind: 'cloud',
      profileId: cloudSession.userId,
      displayName: cloudSession.displayName || cloudSession.email || 'Player',
      email: cloudSession.email || '',
      avatarUrl: cloudSession.avatarUrl || '',
      providers: [...(cloudSession.providers || [])],
      role: cloudSession.role === 'admin' ? 'admin' : 'player',
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
    role: 'player',
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
  // ── internal seams for src/game/cloudAccount.js only ─────────────────────
  __setCloudSession(session) {
    cloudSession = session && session.userId ? { ...session } : null;
    emitAccountChange();
  },
  __setSyncState(status, detail) {
    syncState = {
      status: String(status || 'local-only'),
      lastSyncAt: status === 'saved' ? Date.now() : syncState.lastSyncAt,
      detail: String(detail || ''),
    };
    emitAccountChange();
  },
});

export function installPlayerAccountAuthority(scope = globalThis) {
  const current = scope && scope.APEX_PLAYER_ACCOUNT;
  if (current && current.version === 'a1-player-account-v1') return current;
  if (scope) scope.APEX_PLAYER_ACCOUNT = authority;
  return authority;
}

if (typeof window !== 'undefined') installPlayerAccountAuthority(window);

export default authority;
