// A1 password acceptance flow.
// Existing verified cloud users may set a password in their already
// authenticated session and then sign in from another browser.
// No email, SMS, Google OAuth or password storage on the client.
const validEmail = raw => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw);
const strongPassword = value => typeof value === 'string' && value.length >= 12 && value.length <= 128;
const limited = e => e?.status === 429 || /rate.limit|too many/i.test(e?.message || '');

export async function signInWithEmailPassword(client, rawEmail, password) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!validEmail(email)) return { ok: false, reason: 'invalid-email' };
  if (!password || typeof password !== 'string') return { ok: false, reason: 'password-required' };
  if (!client?.auth?.signInWithPassword) return { ok: false, reason: 'auth-unavailable' };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, reason: limited(error) ? 'auth-rate-limited' : 'invalid-credentials' };
    if (!data?.session?.user?.id) return { ok: false, reason: 'session-not-confirmed' };
    const { data: fresh, error: verifyError } = await client.auth.getUser();
    if (verifyError || fresh?.user?.id !== data.session.user.id) {
      await client.auth.signOut().catch(() => {});
      return { ok: false, reason: 'identity-not-verified' };
    }
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, reason: 'auth-unavailable' };
  }
}

export async function setPasswordForVerifiedUser(client, expectedUserId, password, confirmation) {
  if (!strongPassword(password)) return { ok: false, reason: 'weak-password' };
  if (password !== confirmation) return { ok: false, reason: 'password-mismatch' };
  if (!client?.auth?.getUser || !client?.auth?.updateUser) {
    return { ok: false, reason: 'auth-unavailable' };
  }
  try {
    // Never allow guest, stale account projection or another principal to
    // change credentials for a different user.
    const { data: current, error: verifyError } = await client.auth.getUser();
    if (verifyError || !current?.user?.id || current.user.id !== expectedUserId) {
      return { ok: false, reason: 'identity-not-verified' };
    }
    if (!current.user.email_confirmed_at) return { ok: false, reason: 'email-not-verified' };
    const { error } = await client.auth.updateUser({ password });
    if (error) return { ok: false, reason: limited(error) ? 'auth-rate-limited' : 'password-update-failed' };
    return { ok: true, changed: true };
  } catch {
    return { ok: false, reason: 'password-update-failed' };
  }
}
