// A1 security closeout — guest→admin escalation negatives (Blocker 1).
//
// Regression suite for the independently verified vulnerability in PR #97:
// the public window authority exposed `__setCloudSession(...)` and the
// admin authority trusted the UI profile's `role`, so any guest could run
// one console call and become admin with zero backend (BEFORE evidence in
// docs/a1/A1_SECURITY_CLOSEOUT.md). The redesign:
//   * session/sync setters are ES-module-private (not on window);
//   * the UI profile carries no role and is never authorization evidence;
//   * admin derives only from a server-verified channel
//     (auth.getUser() + account_roles under RLS) or dev-build opt-in;
//   * the locked window bindings cannot be swapped for fake authorities.
//
// This runs against the PRODUCTION build (vite preview, no dev admin, no
// cloud configured → fail-closed) and attacks the surface the way a
// console user would: forged role, global-authority replacement, direct
// Admin/Lab entry calls, the F8 chord, and storage forgery. Device-local
// tampering beyond these seams (rewriting one's own client code) is the
// accepted browser boundary; none of it may yield admin state, real
// rewards or cloud rights through the shipped interfaces.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

assert.equal(typeof process.env.CHROME_PATH, 'string', 'CHROME_PATH is required');
const url = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.env.APEX_EVIDENCE_DIR
  ? path.resolve(process.env.APEX_EVIDENCE_DIR)
  : path.join(root, 'qa-evidence', 'a1-security-negatives');
fs.mkdirSync(output, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checkCount = 0;
const check = (label, fn) => { fn(); checkCount += 1; console.log(`  ✓ ${label}`); };

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function bootHome(target) {
  await target.goto(url + '/?goldViewport=native', { waitUntil: 'domcontentloaded', timeout: 65000 });
  await target.waitForSelector('#apex-boot-start', { visible: true, timeout: 90000 });
  await target.click('#apex-boot-start');
  await target.waitForFunction(
    () => !!document.querySelector('#freeBattle') && document.body?.dataset?.apexSceneTransition === 'DONE',
    { timeout: 60000 });
  await sleep(400);
}

await bootHome(page);

// ── 1. Baseline: a fresh guest is not admin and the profile has no role ────
const baseline = await page.evaluate(() => {
  const profile = window.APEX_PLAYER_ACCOUNT?.profile?.() || {};
  const admin = window.APEX_ADMIN_AUTHORITY || {};
  return {
    kind: profile.kind,
    hasRoleField: 'role' in profile,
    isAdmin: admin.isAdmin?.(),
    adminSource: admin.adminSource?.(),
    canEnter: admin.canEnterAdminTestMode?.(),
    canLaunch: admin.canLaunchAdminSurface?.(),
    credits: window.APEX_ARSENAL_META?.getState?.()?.credits,
    cloudConfigured: window.APEX_CLOUD_ACCOUNT?.isCloudConfigured?.(),
  };
});
check('baseline guest is not admin', () => {
  assert.equal(baseline.kind, 'guest');
  assert.equal(baseline.isAdmin, false);
  assert.equal(baseline.adminSource, null);
  assert.equal(baseline.canEnter, false);
  assert.equal(baseline.canLaunch, false);
  assert.equal(baseline.credits, 350);
});
check('UI profile projection carries NO role field', () => {
  assert.equal(baseline.hasRoleField, false);
});
check('cloud fails closed when unconfigured', () => {
  assert.equal(baseline.cloudConfigured, false);
});

// ── 2. No public setters; authorities frozen; bindings locked ──────────────
const surface = await page.evaluate(() => {
  const desc = (name) => {
    const d = Object.getOwnPropertyDescriptor(window, name);
    return d ? { writable: !!d.writable, configurable: !!d.configurable } : null;
  };
  return {
    setCloudSession: typeof window.APEX_PLAYER_ACCOUNT?.__setCloudSession,
    setSyncState: typeof window.APEX_PLAYER_ACCOUNT?.__setSyncState,
    frozenPlayer: Object.isFrozen(window.APEX_PLAYER_ACCOUNT),
    frozenAdmin: Object.isFrozen(window.APEX_ADMIN_AUTHORITY),
    frozenCloud: Object.isFrozen(window.APEX_CLOUD_ACCOUNT),
    player: desc('APEX_PLAYER_ACCOUNT'),
    admin: desc('APEX_ADMIN_AUTHORITY'),
    cloud: desc('APEX_CLOUD_ACCOUNT'),
  };
});
check('no public __setCloudSession/__setSyncState seams', () => {
  assert.equal(surface.setCloudSession, 'undefined');
  assert.equal(surface.setSyncState, 'undefined');
});
check('all three authority objects are frozen', () => {
  assert.equal(surface.frozenPlayer, true);
  assert.equal(surface.frozenAdmin, true);
  assert.equal(surface.frozenCloud, true);
});
check('window bindings are non-writable and non-configurable', () => {
  for (const key of ['player', 'admin', 'cloud']) {
    assert.equal(surface[key]?.writable, false, key);
    assert.equal(surface[key]?.configurable, false, key);
  }
});

// ── 3. The original attack: forge a cloud admin session via console ─────────
const attackForgedRole = await page.evaluate(() => {
  const out = {};
  const account = window.APEX_PLAYER_ACCOUNT;
  if (typeof account.__setCloudSession === 'function') {
    try {
      account.__setCloudSession({
        userId: 'attacker', email: 'evil@example.invalid', displayName: 'EVIL',
        avatarUrl: '', providers: ['email'], role: 'admin',
      });
    } catch (e) { out.setterThrew = String(e).slice(0, 60); }
  }
  // Method forgery on the frozen object (sloppy assignment silently fails).
  try { account.profile = () => ({ kind: 'cloud', role: 'admin' }); } catch (e) {}
  try { account.__setCloudSession = () => {}; } catch (e) {}
  out.kind = account.profile()?.kind;
  out.hasRole = 'role' in (account.profile() || {});
  out.isAdmin = window.APEX_ADMIN_AUTHORITY?.isAdmin?.();
  out.adminSource = window.APEX_ADMIN_AUTHORITY?.adminSource?.();
  out.setSession = window.APEX_ADMIN_AUTHORITY?.setAdminTestSession?.(true);
  out.sessionActive = window.APEX_ADMIN_AUTHORITY?.isAdminTestSessionActive?.();
  return out;
});
check('forged cloud session / role is ignored', () => {
  assert.equal(attackForgedRole.kind, 'guest');
  assert.equal(attackForgedRole.hasRole, false);
  assert.equal(attackForgedRole.isAdmin, false);
  assert.equal(attackForgedRole.adminSource, null);
  assert.equal(attackForgedRole.setSession, false);
  assert.equal(attackForgedRole.sessionActive, false);
});

// ── 4. Replace the privileged window bindings wholesale ─────────────────────
const attackReplacement = await page.evaluate(() => {
  const fakeAdmin = {
    version: 'a1-admin-authority-v1', isAdmin: () => true, adminSource: () => 'cloud-role',
    canEnterAdminTestMode: () => true, canLaunchAdminSurface: () => true,
    isAdminTestSessionActive: () => true, setAdminTestSession: () => true,
    toggleAdminTestSession: () => ({ ok: true, active: true }),
  };
  try { window.APEX_ADMIN_AUTHORITY = fakeAdmin; } catch (e) {}
  try { delete window.APEX_ADMIN_AUTHORITY; } catch (e) {}
  try { window.APEX_PLAYER_ACCOUNT = { version: 'a1-player-account-v1', profile: () => ({ kind: 'cloud', role: 'admin' }) }; } catch (e) {}
  try { window.APEX_CLOUD_ACCOUNT = { version: 'a1-cloud-account-v1', isCloudConfigured: () => true }; } catch (e) {}
  try {
    Object.defineProperty(window, 'APEX_ADMIN_AUTHORITY', { value: fakeAdmin, writable: true, configurable: true });
  } catch (e) {}
  return {
    adminIsFake: window.APEX_ADMIN_AUTHORITY === fakeAdmin,
    isAdmin: window.APEX_ADMIN_AUTHORITY?.isAdmin?.(),
    setSession: window.APEX_ADMIN_AUTHORITY?.setAdminTestSession?.(true),
    sessionActive: window.APEX_ADMIN_AUTHORITY?.isAdminTestSessionActive?.(),
    kind: window.APEX_PLAYER_ACCOUNT?.profile?.()?.kind,
    cloudConfigured: window.APEX_CLOUD_ACCOUNT?.isCloudConfigured?.(),
    // The decision that matters: locked fighters must stay locked for a
    // non-admin even after every global has been "replaced".
    canSelectHunter: window.APEX_ARSENAL_META?.canPublicSelect?.('HUNTER'),
    credits: window.APEX_ARSENAL_META?.getState?.()?.credits,
  };
});
check('authority binding replacement is rejected end-to-end', () => {
  assert.equal(attackReplacement.adminIsFake, false);
  assert.equal(attackReplacement.isAdmin, false);
  assert.equal(attackReplacement.setSession, false);
  assert.equal(attackReplacement.sessionActive, false);
  assert.equal(attackReplacement.kind, 'guest');
  assert.equal(attackReplacement.cloudConfigured, false);
  assert.equal(attackReplacement.canSelectHunter, false);
  assert.equal(attackReplacement.credits, 350);
});

// ── 5. Direct Admin/Lab entry calls are denied ──────────────────────────────
const labAttack = await page.evaluate(async () => {
  // launchProductSurface is async and denies by resolving `false` (the
  // `{ admin: true }` option is a request, never proof — the authority
  // must confirm a verified admin identity).
  const result = typeof window.apexLaunchArsenalLab === 'function'
    ? await window.apexLaunchArsenalLab({ admin: true }) : 'missing';
  // The generic launcher must deny the same self-serve { admin: true }.
  const result2 = typeof window.apexLaunchProductSurface === 'function'
    ? await window.apexLaunchProductSurface('arsenal-lab', { admin: true }) : 'missing';
  return {
    result,
    result2,
    canLaunchWithoutGrant: window.APEX_PRODUCT_SURFACE?.canLaunch?.('arsenal-lab', { admin: false }),
    fighterScreen: !!document.querySelector('#stage.screen-fighter'),
    waveOverlay: !!document.querySelector('#apex-wave-host'),
    toggle: window.APEX_ADMIN_AUTHORITY?.toggleAdminTestSession?.(),
  };
});
check('direct Lab launch call is denied and mounts nothing', () => {
  assert.equal(labAttack.result, false);
  assert.equal(labAttack.result2, false);
  assert.equal(labAttack.canLaunchWithoutGrant, false);
  assert.equal(labAttack.fighterScreen, false);
  assert.equal(labAttack.waveOverlay, false);
  assert.equal(labAttack.toggle?.ok, false);
});

// ── 6. F8 chord in fighter select: denied, no test session ──────────────────
await page.click('#freeBattle');
await page.waitForSelector('.modeCard', { visible: true, timeout: 30000 });
await page.evaluate(() => {
  const card = [...document.querySelectorAll('.modeCard')]
    .find((c) => (c.innerText || '').toUpperCase().includes('BOT'));
  card?.click();
});
await page.waitForFunction(
  () => document.querySelector('#stage')?.classList.contains('screen-fighter'), { timeout: 45000 });
await sleep(600);
await page.keyboard.down('ControlLeft');
await page.keyboard.down('ShiftLeft');
await page.keyboard.press('F8');
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('ControlLeft');
await sleep(500);
const f8Probe = await page.evaluate(() => ({
  ownerTest: window.APEX_ARSENAL_OWNER_TEST?.active,
  sessionActive: window.APEX_ADMIN_AUTHORITY?.isAdminTestSessionActive?.(),
  isAdmin: window.APEX_ADMIN_AUTHORITY?.isAdmin?.(),
  canSelectHunter: window.APEX_ARSENAL_META?.canPublicSelect?.('HUNTER'),
}));
check('Ctrl+Shift+F8 does not authorize a guest', () => {
  assert.equal(f8Probe.ownerTest, false);
  assert.equal(f8Probe.sessionActive, false);
  assert.equal(f8Probe.isAdmin, false);
  assert.equal(f8Probe.canSelectHunter, false);
});

// ── 7. Admin/Test-shaped rewards never pay AC ───────────────────────────────
const awardProbe = await page.evaluate(() => {
  const meta = window.APEX_ARSENAL_META;
  const before = meta.getState().credits;
  const res = meta.awardBattleResult('P1', {
    battleMode: 'ADMIN', matchId: 'sec-negatives-admin-1', waveReached: 3,
  });
  const res2 = meta.awardBattleResult('P1', {
    battleMode: 'BOT', matchId: 'sec-negatives-lab-1', labMode: true, waveReached: 3,
  });
  return {
    before, after: meta.getState().credits,
    amount: res.amount ?? 0, ok: res.ok, reason: res.reason,
    amount2: res2.amount ?? 0, ok2: res2.ok, reason2: res2.reason,
  };
});
check('Admin/Lab-shaped results award zero AC', () => {
  assert.equal(awardProbe.amount, 0, awardProbe.reason);
  assert.equal(awardProbe.amount2, 0, awardProbe.reason2);
  assert.equal(awardProbe.after, awardProbe.before);
});

// ── 8. Cloud actions stay locked while unconfigured (Blocker 3 honesty) ─────
const cloudProbe = await page.evaluate(async () => {
  const del = await window.APEX_CLOUD_ACCOUNT.requestAccountDeletion();
  const up = await window.APEX_CLOUD_ACCOUNT.uploadProgressSnapshot();
  return { del, up };
});
check('deletion + sync are locked (never fake-succeed) while unconfigured', () => {
  assert.equal(cloudProbe.del.ok, false);
  assert.equal(cloudProbe.del.reason, 'cloud-unconfigured');
  assert.equal(cloudProbe.up.ok, false);
  assert.equal(cloudProbe.up.reason, 'cloud-unconfigured');
});

// ── 9. Storage forgery survives nothing: reload stays guest, not admin ──────
await page.evaluate(() => {
  localStorage.setItem('apexChaos.playerAccount.v1', JSON.stringify({
    profileId: 'forged-id', kind: 'cloud', role: 'admin', displayName: 'FORGED', createdAt: 1,
  }));
});
await bootHome(page);
const storageProbe = await page.evaluate(() => ({
  kind: window.APEX_PLAYER_ACCOUNT?.profile?.()?.kind,
  hasRole: 'role' in (window.APEX_PLAYER_ACCOUNT?.profile?.() || {}),
  isAdmin: window.APEX_ADMIN_AUTHORITY?.isAdmin?.(),
  setSession: window.APEX_ADMIN_AUTHORITY?.setAdminTestSession?.(true),
  credits: window.APEX_ARSENAL_META?.getState?.()?.credits,
}));
check('forged stored profile never yields cloud/admin identity', () => {
  assert.equal(storageProbe.kind, 'guest');
  assert.equal(storageProbe.hasRole, false);
  assert.equal(storageProbe.isAdmin, false);
  assert.equal(storageProbe.setSession, false);
  assert.equal(storageProbe.credits, 350);
});

await page.screenshot({ path: path.join(output, 'after-attacks-home.png') });
const fatal = errors.filter((e) => !/asset-failed|ENGINEER/.test(e));
assert.equal(fatal.length, 0, `page errors: ${fatal.join(' | ')}`);
await browser.close();
console.log(`A1 SECURITY NEGATIVES (admin escalation): PASS (${checkCount} checks, production build, fail-closed)`);
