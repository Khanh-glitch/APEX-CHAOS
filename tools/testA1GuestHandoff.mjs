import assert from 'node:assert/strict';
import { persistGuestHandoffIfEmpty } from '../src/game/guestCloudHandoff.js';

const who = 'user-a';
const guestId = 'guest-abc';
const state = { credits: 50, ownedFighters: ['ROBOT', 'MAGNET'], totalSpins: 1 };
function harness() {
  const saved = { migrations: new Map(), progress: new Map(), calls: [] };
  let authId = who;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: authId } }, error: null }) },
    from(name) {
      if (name === 'guest_migrations') return {
        async upsert(row, opts) {
          saved.calls.push({ action: 'migration', row, opts });
          const key = row.user_id + ':' + row.guest_profile_id;
          if (!saved.migrations.has(key)) saved.migrations.set(key, row);
          return { error: null };
        },
      };
      if (name === 'player_progress') return {
        select(columns) {
          assert.equal(columns, 'version');
          return {
            eq(field1, v1) { assert.equal(field1, 'user_id'); assert.equal(v1, who); return {
              eq(field2, v2) { assert.equal(field2, 'namespace'); assert.equal(v2, 'arsenalMeta'); return {
                maybeSingle: async () => ({ data: saved.progress.get(v1) ?? null, error: null }),
              }; },
            }; },
          };
        },
      };
      throw new Error('unexpected table ' + name);
    },
    async rpc(name, args) {
      assert.equal(name, 'save_progress_snapshot_cas');
      assert.equal(args.p_expected_version, 0, 'autobackup cannot ever overwrite existing');
      assert.equal(args.p_payload.unverified, true);
      saved.calls.push({ action: 'cas0', args });
      if (saved.progress.has(who)) return { data: [{ ok: false, current_version: saved.progress.get(who).version }], error: null };
      saved.progress.set(who, { version: 1 });
      return { data: [{ ok: true, current_version: 1 }], error: null };
    },
  };
  return { client, saved, setAuthId: (id) => { authId = id; } };
}
const input = h => ({ client: h.client, userId: who, guestId, snapshot: state, stillValid: () => true });
let checks = 0;
function pass(message) { checks++; console.log('PASS', message); }

{
  const h = harness();
  const first = await persistGuestHandoffIfEmpty(input(h));
  assert.deepEqual(first, { ok: true, result: 'created', currentVersion: 1 });
  assert.equal(h.saved.migrations.size, 1);
  assert.equal(h.saved.migrations.values().next().value.snapshot.unverified, true);
  assert.equal(h.saved.migrations.values().next().value.status, 'pending-review');
  assert.equal(h.saved.calls.filter(x => x.action === 'cas0').length, 1);
  pass('new Magic Link account gets one pending unverified lineage + CAS0 snapshot');

  const again = await persistGuestHandoffIfEmpty(input(h));
  assert.equal(again.result, 'existing');
  assert.equal(h.saved.migrations.size, 1);
  assert.equal(h.saved.calls.filter(x => x.action === 'cas0').length, 1);
  pass('duplicate callback/tab cannot create another lineage or overwrite snapshot');
}
{
  const h = harness();
  h.saved.progress.set(who, { version: 8 });
  const before = h.saved.progress.get(who);
  const result = await persistGuestHandoffIfEmpty(input(h));
  assert.equal(result.result, 'existing');
  assert.equal(h.saved.progress.get(who), before);
  assert.equal(h.saved.calls.filter(x => x.action === 'cas0').length, 0);
  pass('existing cloud snapshot preserved, even when device credits differ');
}
{
  const h = harness(); h.setAuthId('user-b');
  const result = await persistGuestHandoffIfEmpty(input(h));
  assert.equal(result.reason, 'identity-not-verified');
  assert.equal(h.saved.calls.length, 0);
  pass('changed Auth principal denied before any migration write');
}
{
  const h = harness(); let valid = false;
  const result = await persistGuestHandoffIfEmpty({ ...input(h), stillValid: () => valid });
  assert.equal(result.reason, 'handoff-not-ready');
  assert.equal(h.saved.calls.length, 0);
  pass('sign-out or superseded session cannot begin handoff');
}
{
  const h = harness();
  const original = h.client.auth.getUser;
  let valid = true;
  h.client.auth.getUser = async () => { valid = false; return original(); };
  const result = await persistGuestHandoffIfEmpty({ ...input(h), stillValid: () => valid });
  assert.equal(result.reason, 'identity-not-verified');
  assert.equal(h.saved.calls.length, 0);
  pass('stale async verification cannot write after account switch');
}
{
  const h = harness();
  const original = h.client.rpc;
  h.client.rpc = async (name, args) => {
    h.saved.progress.set(who, { version: 5 });
    return original(name, args);
  };
  const result = await persistGuestHandoffIfEmpty(input(h));
  assert.equal(result.result, 'existing');
  assert.equal(result.currentVersion, 5);
  assert.equal(h.saved.progress.get(who).version, 5);
  pass('two tabs racing CAS0: loser never overwrites winner');
}
console.log('A1 GUEST HANDOFF SECURITY: PASS ('+checks+' independent tests)');
