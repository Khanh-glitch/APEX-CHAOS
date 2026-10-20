// A1.2 — guest snapshot handoff, NEVER an authoritative wallet import.
// Only unverified device state is preserved, pending staff review.
// A1 SQL migration 0004 enforces (user_id, guest_profile_id) idempotency.
export async function persistGuestHandoffIfEmpty({ client, userId, guestId, snapshot, stillValid }) {
  const valid = () => typeof stillValid === 'function' && stillValid() === true;
  if (!client || typeof userId !== 'string' || !userId
      || typeof guestId !== 'string' || !guestId || !snapshot || !valid()) {
    return { ok: false, reason: 'handoff-not-ready' };
  }
  try {
    // Auth session projection is display-only: always verify against GoTrue.
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || auth?.user?.id !== userId || !valid()) {
      return { ok: false, reason: 'identity-not-verified' };
    }

    // FIRST check whether this Cloud identity already has a snapshot.
    // This is critical on a second browser: its brand-new local Guest
    // profile must NOT become another pending import just by signing in.
    const { data: existing, error: lookupError } = await client.from('player_progress')
      .select('version').eq('user_id', userId).eq('namespace', 'arsenalMeta').maybeSingle();
    if (lookupError) return { ok: false, reason: 'snapshot-lookup-failed' };
    if (!valid()) return { ok: false, reason: 'session-superseded' };
    if (existing) {
      return { ok: true, result: 'existing', currentVersion: Number(existing.version) || 1 };
    }

    // Only the device that may CREATE the very first snapshot records a
    // candidate lineage, never a signed-in second device with an existing
    // account backup. Never award server AC or ownership.
    const { error: lineageError } = await client.from('guest_migrations').upsert({
      user_id: userId,
      guest_profile_id: guestId,
      snapshot: { unverified: true, state: snapshot },
      status: 'pending-review',
    }, { onConflict: 'user_id,guest_profile_id', ignoreDuplicates: true });
    if (lineageError) return { ok: false, reason: 'lineage-write-failed' };
    if (!valid()) return { ok: false, reason: 'session-superseded' };

    // CAS version 0 is an insert-if-absent. Competing tabs/devices cannot
    // overwrite each other, even if they both saw an empty lookup.
    const { data, error: writeError } = await client.rpc('save_progress_snapshot_cas', {
      p_namespace: 'arsenalMeta',
      p_expected_version: 0,
      p_payload: { unverified: true, guestProfileId: guestId, state: snapshot },
    });
    if (writeError) return { ok: false, reason: 'snapshot-write-failed' };
    if (!valid()) return { ok: false, reason: 'session-superseded' };
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.ok === true) {
      return { ok: true, result: 'created', currentVersion: Number(row.current_version) };
    }
    // CAS race winner lives on server. This client changed nothing.
    return { ok: true, result: 'existing', currentVersion: Number(row?.current_version) || 1 };
  } catch {
    return { ok: false, reason: 'handoff-unavailable' };
  }
}
