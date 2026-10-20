// APEX CHAOS admin authorization — the ONE authority (A1.4).
//
// Ctrl+Shift+F8 (arsenalConfig.js owner weapon test) and the Arsenal Lab
// launch seam (window.apexLaunchArsenalLab in App.jsx) are INTERFACES, not
// authorization. Both must ask this module. Authorization derives from:
//
//   1. A SERVER-VERIFIED cloud admin: cloudAccount.js confirms the session
//      with the auth server (`auth.getUser()`), reads the caller's own
//      `public.account_roles` row under RLS, and only then feeds the user
//      id through the module-private channel at the bottom of this file.
//      The display profile (APEX_PLAYER_ACCOUNT) is NEVER consulted here —
//      the pre-closeout build trusted it, and a guest forging the profile
//      projection could self-grant admin (A1 closeout Blocker 1,
//      regression-tested by tools/testAdminEscalationNegativesBrowser.mjs).
//   2. A development-build-only opt-in: `vite dev` with
//      VITE_APEX_DEV_ADMIN=1. Production builds ignore that variable because
//      import.meta.env.DEV is false there.
//
// With no configured backend, production fails closed: no cloud admin can
// exist. Nothing else grants admin: not localStorage, not query parameters,
// not client globals, not the keyboard shortcut itself. The window binding
// is installed non-writable + non-configurable so classic-script consumers
// cannot have the authority swapped out from under them. The test session
// is ephemeral (never persisted); economy code independently refuses to pay
// AC while a test session/lab is active, so even a tampered client session
// can never enter the real wallet ledger. Server-side, every privileged
// RPC re-derives the caller from auth.uid() under RLS — a tampered client
// gains no server rights and no valid cloud assets.

let testSessionActive = false;
let verifiedCloudAdminUserId = null;

function devAdminEnabled() {
  try {
    return !!(import.meta.env && import.meta.env.DEV === true
      && import.meta.env.VITE_APEX_DEV_ADMIN === '1');
  } catch (error) {
    return false;
  }
}

function cloudAdminRole() {
  // Deliberately NOT derived from the UI profile projection or any window
  // object: this flag is set exclusively through the module-private
  // verified channel below, after server-side identity + role checks.
  return verifiedCloudAdminUserId !== null;
}

function isAdmin() {
  return cloudAdminRole() || devAdminEnabled();
}

function emitSessionChange() {
  try {
    window.dispatchEvent(new CustomEvent('apex:admin-session', {
      detail: { active: testSessionActive },
    }));
  } catch (error) {}
}

const authority = Object.freeze({
  version: 'a1-admin-authority-v1',
  isAdmin,
  adminSource() {
    if (cloudAdminRole()) return 'cloud-role';
    if (devAdminEnabled()) return 'dev-build';
    return null;
  },
  canEnterAdminTestMode() {
    return isAdmin();
  },
  canLaunchAdminSurface() {
    return isAdmin();
  },
  isAdminTestSessionActive() {
    // A session is only ever live while authorization still holds. If the
    // cloud session signs out mid-test, the session evaporates immediately.
    if (testSessionActive && !isAdmin()) {
      testSessionActive = false;
      emitSessionChange();
    }
    return testSessionActive;
  },
  // Returns true only when the requested state is now in effect. Turning a
  // session ON re-checks authorization; turning it OFF always succeeds.
  setAdminTestSession(on) {
    const want = on === true;
    if (want && !isAdmin()) return false;
    if (testSessionActive !== want) {
      testSessionActive = want;
      emitSessionChange();
    }
    return testSessionActive === want;
  },
  toggleAdminTestSession() {
    if (testSessionActive) {
      this.setAdminTestSession(false);
      return { ok: true, active: false };
    }
    if (!isAdmin()) return { ok: false, active: false, reason: 'not-authorized' };
    this.setAdminTestSession(true);
    return { ok: true, active: true };
  },
});

export function installAdminAuthority(scope = globalThis) {
  const current = scope && scope.APEX_ADMIN_AUTHORITY;
  if (current && current.version === 'a1-admin-authority-v1') return current;
  if (scope) {
    // Lock the binding: arsenalConfig.js and the economy runtime read this
    // authority through window at decision time, so the genuine object
    // must not be swappable from the console or another script.
    try {
      Object.defineProperty(scope, 'APEX_ADMIN_AUTHORITY', {
        value: authority, writable: false, configurable: false, enumerable: true,
      });
    } catch (error) {
      try { scope.APEX_ADMIN_AUTHORITY = authority; } catch (ignored) {}
    }
  }
  // Losing the cloud session (sign-out) must end any live test session.
  try {
    scope.addEventListener?.('apex:account', () => {
      if (testSessionActive && !isAdmin()) {
        testSessionActive = false;
        emitSessionChange();
      }
    });
  } catch (error) {}
  return authority;
}

if (typeof window !== 'undefined') installAdminAuthority(window);

export default authority;

// ── Module-private verified-admin channel ───────────────────────────────────
// Imported ONLY by src/game/cloudAccount.js after it has (1) re-validated
// the session against the auth server via `auth.getUser()` and (2) read an
// 'admin' row for that exact user from public.account_roles under RLS.
// Never attached to window or to the frozen authority object: module scope
// is not reachable from the devtools console, so this grant cannot be
// forged by a guest (A1 closeout Blocker 1). Pass null to revoke; any live
// test session ends immediately on revocation.
export function setVerifiedCloudAdminInternal(userId) {
  verifiedCloudAdminUserId = typeof userId === 'string' && userId ? userId : null;
  if (testSessionActive && !isAdmin()) {
    testSessionActive = false;
    emitSessionChange();
  }
}
