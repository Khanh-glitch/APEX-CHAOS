// A1.2 Cloudflare staging: PUBLIC HTTP contract checks, no login or secret keys.
// Run only against the separately provisioned APEX Supabase staging endpoint.
// Does not create accounts, mint credits, mutate state or call production.
import assert from 'node:assert/strict';

const projectId = 'pqnhyucmziucjqbxmtbc';
const origin = `https://${projectId}.supabase.co`;
const envOrigin = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
assert.equal(envOrigin, origin, 'FAIL CLOSED: wrong Supabase project; production is forbidden');
const key = process.env.VITE_SUPABASE_ANON_KEY || '';
assert.ok(key.startsWith('sb_publishable_') || key.startsWith('eyJ'), 'Staging publishable key missing');

const headers = { apikey: key, Authorization: `Bearer ${key}` };
async function request(method, path, data) {
  const res = await fetch(origin + path, {
    method,
    headers: { ...headers, ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await res.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = null; }
  return { status: res.status, json };
}
function pass(title, detail = '') { console.log('PASS', title, detail); }

const health = await request('GET', '/auth/v1/health');
assert.equal(health.status, 200, 'Auth health unavailable');
pass('Hosted Auth health');

const settings = await request('GET', '/auth/v1/settings');
assert.equal(settings.status, 200, 'Auth settings unavailable');
assert.equal(settings.json?.external?.email, true, 'Email Auth not enabled');
pass('Email provider enabled');
console.log('PENDING Google OAuth:', settings.json?.external?.google === true ? 'enabled (not login-verified)' : 'disabled');

for (const table of ['wallets', 'account_roles', 'player_progress', 'app_config']) {
  const response = await request('GET', `/rest/v1/${table}?select=*`);
  assert.equal(response.status, 200, `Anonymous ${table} request failed unexpectedly`);
  assert.ok(Array.isArray(response.json) && response.json.length === 0,
    `Anonymous ${table} leaked rows`);
  pass(`Anon ${table} stays empty (RLS)`);
}
const denied = [
  ['claim_match_reward', { p_claim_key: 'a1-staging-anon-denied', p_mode: 'BOT', p_outcome: 'P1' }],
  ['buy_fighter', { p_fighter_id: 'ROBOT', p_idempotency_key: 'a1-staging-anon-denied' }],
  ['lucky_draw', { p_idempotency_key: 'a1-staging-anon-denied' }],
  ['request_account_deletion', {}],
  ['save_progress_snapshot_cas', { p_namespace: 'arsenalMeta', p_expected_version: 0, p_payload: {} }],
];
for (const [rpc, payload] of denied) {
  const res = await request('POST', `/rest/v1/rpc/${rpc}`, payload);
  assert.ok([401, 403].includes(res.status) && res.json?.code === '42501',
    `Anonymous RPC ${rpc} was not permission-denied: ${res.status}/${res.json?.code}`);
  pass(`Anon privileged RPC denied: ${rpc}`);
}
console.log('A1 STAGING PUBLIC HTTP SECURITY: PASS (no users created; no mutations)');
