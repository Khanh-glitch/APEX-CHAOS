// A1.2 — validate a copied hosted Supabase confirmation URL locally.
// Browsers intentionally do NOT share Auth sessions. A Magic Link clicked in
// the default browser cannot authenticate an unrelated incognito/device tab.
// Accept only the configured project's HTTPS verification endpoint with a
// redirect back to this exact game origin. Never log or persist the secret URL.
export function parseEmailMagicLink(raw, { supabaseUrl, appOrigin }) {
  if (typeof raw !== 'string' || raw.trim().length > 8192) return null;
  try {
    const project = new URL(supabaseUrl);
    const app = new URL(appOrigin);
    const link = new URL(raw.trim());
    if (project.protocol !== 'https:' || app.protocol !== 'https:'
      || link.protocol !== 'https:' || link.origin !== project.origin
      || link.pathname !== '/auth/v1/verify'
      || link.username || link.password || link.hash) return null;
    const type = link.searchParams.get('type');
    if (!['magiclink', 'signup', 'email'].includes(type)) return null;
    const token = link.searchParams.get('token') || link.searchParams.get('token_hash');
    if (!token || token.length < 10 || token.length > 2048) return null;
    // PostgREST/Supabase email templates normally include redirect_to;
    // without it the project Site URL is used (must also be configured to
    // this staging origin). Reject explicit different destinations.
    const redirect = link.searchParams.get('redirect_to');
    if (redirect) {
      const dest = new URL(redirect);
      if (dest.origin !== app.origin || dest.pathname !== '/'
        || dest.username || dest.password || dest.protocol !== 'https:')
        return null;
    }
    return link.href;
  } catch {
    return null;
  }
}
