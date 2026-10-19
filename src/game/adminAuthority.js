// APEX CHAOS admin authorization — the ONE authority (A1.4).
//
// Ctrl+Shift+F8 (arsenalConfig.js owner weapon test) and the Arsenal Lab
// launch seam (window.apexLaunchArsenalLab in App.jsx) are INTERFACES, not
// authorization. Both must ask this module. Authorization derives from:
//
//   1. An authenticated cloud session whose server-verified role is 'admin'
//      (public.account_roles, surfaced through APEX_PLAYER_ACCOUNT), or
//   2. A development-build-only opt-in: `vite dev` with
//      VITE_APEX_DEV_ADMIN=1. Production builds ignore that variable because
//      import.meta.env.DEV is false there.
//
// Nothing else grants admin: not localStorage, not query parameters, not
// client globals, not the keyboard shortcut itself. The test session is
// ephemeral (never persisted); economy code independently refuses to pay AC
// while a test session/lab is active, so even a tampered client session can
// never enter the real wallet ledger.

let testSessionActive = false;

function devAdminEnabled() {
  try {
    return import.meta.env && import.meta.env.DEV === true
      && import.meta.env.VITE_APEX_DEV_ADMIN === '1';
  } catch (error) {
    return false;
  }
}

function cloudAdminRole() {
  try {
    const account = typeof window !== 'undefined' ? window.APEX_PLAYER_ACCOUNT : null;
    if (!account || typeof account.profile !== 'function') return false;
    const profile = account.profile();
    return !!profile && profile.kind === 'cloud' && profile.role === 'admin';
  } catch (error) {
    return false;
  }
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
  if (scope) scope.APEX_ADMIN_AUTHORITY = authority;
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
