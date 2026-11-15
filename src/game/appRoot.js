// ---------------------------------------------------------------------------
// App-root URL authority for subpath hosting (itch.io /html/<id>/ nested
// ZIPs, preview branches, root deploys).
//
// Captured ONCE from the entry document URL at bundle init. The Gold mount
// later inserts <base href="/gold/"> so donor-relative refs resolve inside
// the Gold tree — but PRODUCT runtime URLs ('/game/...', '/assets/...')
// must never resolve against that element: under nested hosting the
// deferred battle runtimes otherwise point at <app>/gold/game/... and 404,
// so BATTLE READY can never start a battle (RC nested-Chrome proof).
// Resolving against the entry directory is identical on a root deploy and
// correct inside any subpath, with no build-time rewriting involved.
// ---------------------------------------------------------------------------
const ENTRY_BASE = (() => {
  try {
    return new URL('./', window.location.href).href;
  } catch (_) {
    return null;
  }
})();

export const APEX_APP_ENTRY_BASE = ENTRY_BASE;

export function apexAppUrl(path) {
  const raw = String(path ?? '');
  // An empty path is "no art", never the app root: resolving '' to the entry
  // directory produced <img src=".../html/apex/"> placeholders that 0-decode.
  if (!raw) return '';
  if (!ENTRY_BASE) return raw;
  try {
    return new URL(raw.replace(/^\//, ''), ENTRY_BASE).href;
  } catch (_) {
    return raw;
  }
}

// CP4: classic product runtimes (Gold bridge Result iframe) resolve through
// the SAME entry-base authority instead of origin-root literals, which 404
// under nested /html/<id>/ hosting.
try {
  window.APEX_APP_ENTRY_BASE = ENTRY_BASE;
  window.APEX_APP_URL = apexAppUrl;
} catch (_) { /* non-browser bundle contexts keep module-only access */ }
