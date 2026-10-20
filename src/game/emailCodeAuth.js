// A1.2 email OTP adapter: Supabase sends a six-digit code ONLY when both
// hosted Auth email templates actually contain {{ .Token }}.
// This module never sends email itself, stores codes, mints rewards, or
// transports credentials across browser tabs.
const validEmail = x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const rateLimited = error => error?.status === 429
  || /rate.?limit|too many|email quota/i.test(error?.message || '');

export async function requestEmailCode(client, rawEmail, redirectTo) {
  const email = String(rawEmail || '').trim();
  if (!validEmail(email)) return { ok: false, reason: 'invalid-email' };
  if (!client?.auth?.signInWithOtp) return { ok: false, reason: 'email-service-unavailable' };
  try {
    const { error } = await client.auth.signInWithOtp({
      email, options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    if (error) return { ok: false, reason: rateLimited(error) ? 'email-rate-limited' : 'email-send-failed' };
    return { ok: true, sent: true, email };
  } catch {
    return { ok: false, reason: 'email-send-failed' };
  }
}

export async function confirmEmailCode(client, rawEmail, rawCode) {
  const email = String(rawEmail || '').trim();
  const token = String(rawCode || '').trim();
  if (!validEmail(email) || !/^\d{6}$/.test(token)) return { ok: false, reason: 'invalid-code' };
  if (!client?.auth?.verifyOtp) return { ok: false, reason: 'email-service-unavailable' };
  try {
    const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { ok: false, reason: rateLimited(error) ? 'verify-rate-limited' : 'invalid-or-expired-code' };
    if (!data?.session?.user?.id) return { ok: false, reason: 'session-not-confirmed' };
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, reason: 'invalid-or-expired-code' };
  }
}
