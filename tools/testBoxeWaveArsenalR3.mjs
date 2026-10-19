// BOT WAVE arsenal authority — production contract (F1).
// Proof level: EXECUTION (live Arsenal config run in VM; campaign indexNative/planWave executed) + SOURCE-CONTRACT scans for copied gun stats.
//
// History: this file tested src/game/botWave/apexGunLoadouts.js, a hand-
// copied twin of Free Battle gun numbers. Production never imported it;
// BOT WAVE consumes the live APEX_ARSENAL_CONFIG through waveCampaign.js
// and nativeArsenalGoldBridge.js with all gun scalars pinned to 1. This
// contract now proves the numbers come from that single source and that no
// second gun-stat table exists anywhere in the BOT WAVE surface.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

await import('../public/game/bot-wave/waveCampaign.js');
const { planWave } = globalThis.APEX_BOT_WAVE_CAMPAIGN;

const sandbox = { console, setTimeout() { return 0; }, clearTimeout() {}, window: { addEventListener() {}, removeEventListener() {} }, document: { getElementById() { return null; }, addEventListener() {}, querySelector() { return null; } } };
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync('public/game/arsenal/arsenalConfig.js', 'utf8'), sandbox, { timeout: 2000 });
vm.runInNewContext(fs.readFileSync('public/game/arsenal/arsenalIdentityRuntime.js', 'utf8'), sandbox, { timeout: 2000 });
const config = sandbox.window.APEX_ARSENAL_CONFIG;
assert.equal(sandbox.window.apexArsenalIdentityRuntime, 'ready');

// Canonical post-x7 Free Battle numbers, read from their one home.
assert.equal(config.WEAPONS.PISTOL.damagePerShot, 4.5, 'Pistol raw damage stays 4.5');
assert.equal(config.ARSENAL_DAMAGE_SCALE, 7, 'global x7 sustained scale stays in the config');
assert.equal(config.WEAPONS.PISTOL.damagePerShot * config.ARSENAL_DAMAGE_SCALE, 31.5, 'Pistol non-crit hit is exactly 31.5');
assert.equal(config.WEAPONS.SHOTGUN.pellets, 6);
assert.equal(config.WEAPONS.SNIPER.aimTime, 0.8);
assert.equal(config.P0_WEAPON_IDS.length, 41);

// The campaign never rescales guns for wave mode.
for (const w of [1, 5, 10, 17, 30, 40]) {
  const p = planWave(config, w);
  assert.equal(p.gunDamageScalar, 1, 'wave ' + w + ' damage scalar');
  assert.equal(p.gunCadenceScalar, 1, 'wave ' + w + ' cadence scalar');
  assert.equal(p.gunProjectileSpeedScalar, 1, 'wave ' + w + ' projectile scalar');
  assert.equal(p.damageAuthority, 'FREE_BATTLE_POST_X7');
}

// Campaign indexing reads live config fields — a spec edit must flow through.
const { indexNative } = globalThis.APEX_BOT_WAVE_CAMPAIGN;
const catalog = indexNative(config);
assert.equal(catalog.records.length, 41);
assert.equal(catalog.allWeaponIds.length, 41);
assert.ok(catalog.records.every(w => w.spec === config.WEAPONS[w.id]), 'catalog must reference live config specs, not copies');
assert.ok(catalog.records.every(w => ['defend', 'close', 'zone', 'snipe', 'flank', 'signature', 'fire'].includes(w.role)), 'roles derive from live weapon families');
assert.deepEqual(catalog.ordered.slice(0, 5).map(w => w.id), ['PISTOL', 'SMG', 'SHOTGUN', 'SNIPER', 'GRENADE'], 'iconic starters lead the reveal order');

// No second gun-stat authority anywhere in the BOT WAVE surface. Real spec
// literals (damagePerShot assignments) may exist ONLY in the Arsenal config.
const surfaces = [
  'public/game/bot-wave/waveCampaign.js',
  'public/game/bot-wave/nativeArsenalGoldBridge.js',
];
for (const f of surfaces) {
  const src = fs.readFileSync(f, 'utf8');
  assert.ok(!/damagePerShot\s*:\s*[0-9]/.test(src), f + ' must not copy gun damage numbers');
  assert.ok(!src.includes('APEX_WAVE_GUNS') && !src.includes('waveGunSpec') || src.includes('waveGunId'), f + ' must not define a parallel gun table');
}
const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const pilot = game.slice(game.indexOf('/* BOXE BOT WAVE pilot'));
assert.ok(!/damagePerShot\s*:\s*[0-9]/.test(pilot), 'pilot must not copy gun damage numbers');
assert.ok(pilot.includes("loadWaveDependency('/game/arsenal/arsenalConfig.js')"), 'pilot must load the live config');
assert.ok(pilot.includes('CFG=window.APEX_ARSENAL_CONFIG'), 'pilot must plan against the live config object');

// Anti-twin (F1): the copied loadout table must stay deleted.
assert.ok(!fs.existsSync('src/game/botWave/apexGunLoadouts.js'), 'apexGunLoadouts twin must not return');
console.log('BOXE WAVE R3 ARSENAL PASS: post-x7 config is the only gun-number authority (Pistol 31.5), campaign scalars all 1, no copied gun table in any BOT WAVE surface');
