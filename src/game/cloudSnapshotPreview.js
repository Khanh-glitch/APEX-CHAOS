// A1.2 read-only snapshot preview. No imported client state may mutate
// the device economy. The JSON is unverified guest-provided data.
export function describeUnverifiedCloudSnapshot(record) {
  if (!record) return { exists: false, version: 0, unverified: false, deviceCredits: null, deviceDraws: null, deviceFighters: [] };
  const ver = Number(record.version);
  if (!Number.isSafeInteger(ver) || ver < 1) throw Error('invalid-snapshot-version');
  const payload = record.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.unverified !== true) {
    throw Error('unsupported-snapshot-payload');
  }
  const state = payload.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw Error('invalid-unverified-state');
  }
  const n = x => Number.isSafeInteger(x) && x >= 0 ? x : null;
  const fighters = Array.isArray(state.ownedFighters)
    ? [...new Set(state.ownedFighters.filter(x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(x)))].slice(0, 32)
    : [];
  return {
    exists: true,
    version: ver,
    unverified: true,
    deviceCredits: n(state.credits),
    deviceDraws: n(state.totalSpins),
    deviceFighters: fighters,
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : null,
  };
}
