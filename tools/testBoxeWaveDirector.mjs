// BOT WAVE single-authority director contract (F1).
//
// History: this file used to test src/game/botWave/waveDirector.js, an R2-R5
// staging prototype that production never imported. Its assertions passed
// against dead logic while the shipped director (waveCampaign.js, consumed
// by the pilot in public/bot-wave/game.html) followed different counts, XP
// and boss cadence. The prototype modules were deleted; this contract now
// verifies the PRODUCTION director with the REAL Free Battle Arsenal config,
// locks its deterministic output with golden hashes, and guards against a
// second gameplay-logic twin reappearing under src/game/botWave/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

await import('../public/game/bot-wave/waveCampaign.js');
const campaign = globalThis.APEX_BOT_WAVE_CAMPAIGN;
assert.ok(campaign?.planWave && campaign?.indexNative, 'production campaign API must load');
const { planWave, beats, survival, clusterLength } = campaign;

// Real Arsenal authority, executed — never a copied gun table.
const sandbox = { console, setTimeout() { return 0; }, clearTimeout() {}, window: { addEventListener() {}, removeEventListener() {} }, document: { getElementById() { return null; }, addEventListener() {}, querySelector() { return null; } } };
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync('public/game/arsenal/arsenalConfig.js', 'utf8'), sandbox, { timeout: 2000 });
vm.runInNewContext(fs.readFileSync('public/game/arsenal/arsenalIdentityRuntime.js', 'utf8'), sandbox, { timeout: 2000 });
const config = sandbox.window.APEX_ARSENAL_CONFIG;
assert.equal(sandbox.window.apexArsenalIdentityRuntime, 'ready');
assert.equal(config.P0_WEAPON_IDS.length, 41, 'campaign plans over the live 41-weapon Arsenal');

// Authored ten-wave cluster arc is the single scheduling law.
assert.equal(clusterLength, 10);
assert.deepEqual(beats.map(b => b.count), [12, 9, 11, 14, 16, 16, 20, 18, 20, 10]);
assert.deepEqual(beats.map(b => b.cap), [3, 3, 4, 4, 4, 5, 4, 5, 6, 4]);
assert.deepEqual(beats.map(b => b.pressure), [150, 175, 200, 230, 250, 300, 210, 340, 380, 280]);
assert.deepEqual(beats.map(b => b.id), ['farm', 'teach', 'teach', 'mix', 'mix', 'spike', 'power', 'crescendo', 'crescendo', 'boss']);
assert.deepEqual(survival, {
  startingHP: 1000, baseKillHealFraction: .005,
  healthPack: { dropChance: .04, healFraction: .10, lifetimeSeconds: 8, maxActive: 1 },
});

// Deterministic planning + semantic laws.
assert.deepEqual(planWave(config, 17, { seed: 88 }), planWave(config, 17, { seed: 88 }), 'same seed must reproduce the same wave');
assert.throws(() => planWave(config, 0), /WAVE_INVALID_INDEX/);
const w1 = planWave(config, 1);
assert.equal(w1.composition.length, 6);
assert.equal(w1.concurrentLimit, 2);
assert.equal(w1.pressureBudget, 110);
assert.ok(w1.composition.every(e => e.weaponId === 'PISTOL' && !e.boss), 'wave 1 is the Pistol tutorial');
assert.equal(planWave(config, 5).boss, false, 'no boss at wave 5 in production law');
for (const w of [10, 20, 30, 40]) {
  const p = planWave(config, w);
  assert.equal(p.boss, true, 'boss closes each 10-wave cluster: wave ' + w);
  assert.equal(p.composition[0].boss, true, 'boss leads the spawn queue: wave ' + w);
}
for (let w = 1; w <= 40; w++) {
  const p = planWave(config, w);
  assert.equal(p.clusterWave, ((w - 1) % 10) + 1);
  assert.equal(p.gunDamageScalar, 1);
  assert.equal(p.gunCadenceScalar, 1);
  assert.equal(p.gunProjectileSpeedScalar, 1);
  assert.equal(p.damageAuthority, 'FREE_BATTLE_POST_X7');
  assert.equal(p.reloadPolicy, 'KEEP_WEAPON_AND_REFILL_MAGAZINE');
  assert.equal(p.infinite, true, 'no finite chapter ending');
  assert.ok(p.composition.every(e => ['top', 'right', 'bottom', 'left'].includes(e.edge)));
  assert.ok(p.composition.every(e => e.edgeFraction >= .1 && e.edgeFraction <= .9));
}
assert.equal(planWave(config, 29).revealedWeapons < 41, true);
assert.equal(planWave(config, 30).revealedWeapons, 41, 'all 41 weapons revealed by wave 30');
assert.equal(planWave(config, 150).wave, 150);

// Golden parity lock (F1 baseline, recorded from the shipped director before
// the refactor; production planning output must stay bit-identical).
const sha = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const GOLDEN = ('d821716b5a4c4cd8,5b7d14fb96fe0472,8db6df0935d4d1a6,b6af8a5c8f7d9467,fc70fbf19cd4cec3,' +
  '9122776110298f88,4875a1ba9ce225dd,eaa7be8c06d03d2e,874b9087f0a11917,eb745c037b4f5015,' +
  'e2c4a418c08a4dd7,d0b4f7485004ec0b,4a99dd5dc09b1a26,0b5cdd13d7cf30b9,e7ec3020cb49fd75,' +
  '6045b360e53121bb,4524d9e0ab6a84a7,cc9a38a2b5086ed6,14c07d976b7e77de,6fcb3feab044dbd8,' +
  '4c0abcaeb450696d,6067f0e3cb6caccc,230211e07916a83d,3584ce63c813f8c1,4af037e11692a689,' +
  '927ca85540596db3,ffeeff48fe2a778b,a1432a077637a3db,e524b29272d86a94,a463178ac5a25cb7,' +
  '463fe336828f189f,1ffecba402581a18,6f66e2794f49c6e6,ae3e8c1d98e70a0e,aeae2304017940cd,' +
  'f56439544681e393,769b2df6b915b594,db06fd2a2eb54a74,cbce4f24cd254d27,2f7bc3b5dcf43964').split(',');
GOLDEN.forEach((expected, i) => {
  const seed = i < 40 ? 41 : 7;
  const wave = (i % 40) + 1;
  assert.equal(sha(planWave(config, wave, { seed })), expected, `golden plan drift: seed ${seed} wave ${wave}`);
});
const GOLDEN7 = ('bb35890081baaf7c,f958d0ea13794bc8,9ddf2a6d075d923f,1f9d441792262a97,77f23a3184f5c9b2,' +
  '9110f8fa409f30cc,e8448e10fae75d5e,6dded7cdb711d4a0,a058e5f9168677f3,0892d96140b98c63,' +
  '1ba48b693b41d974,ed43727ec6c2e1e4,1cf4f98aba48b5e6,d452b5ada887c36a,868a02069bc085d1,' +
  '9ec91491570a59c8,c672d963266dca87,081e2d6b282d5d6a,680991efc699e33c,ca51e3dc38e65916,' +
  '34718bd3e2511ec4,55ce1b26e88fab68,f0da1bd301efd9be,fa338c55dfe5139e,34e78b68169bb259,' +
  'ee888860a240ccf3,36d32aba52d33d6b,3ac940dfc768879e,91ad5092c35c1f4b,ac24be3f249e2cd7,' +
  'ee7d7826512745cc,54d9a19f13399455,f4a374d74492204c,4c135b1c78d20d25,62241251f0c353a0,' +
  '1a840a6540935571,98d32374cee11adf,f38e13fdb5cd3782,985aec804cc480c1,30796cd03cd1e660').split(',');
GOLDEN7.forEach((expected, i) => {
  assert.equal(sha(planWave(config, i + 1, { seed: 7 })), expected, `golden plan drift: seed 7 wave ${i + 1}`);
});

// The shipped pilot consumes THIS director (no second planner in game.html).
const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const pilot = game.slice(game.indexOf('/* BOXE BOT WAVE pilot'));
assert.ok(pilot.includes("loadWaveDependency('/game/bot-wave/waveCampaign.js')"), 'pilot must load the production campaign');
assert.ok(pilot.includes('CAMPAIGN.planWave(CFG,n)'), 'pilot must plan waves through the production campaign');
assert.ok(!pilot.includes('PLAN_BEATS') && !pilot.includes('buildWavePlan'), 'pilot must not carry a twin wave table/planner');

// Anti-twin regression guard (F1): the deleted staging prototypes must not
// come back as a second, diverging gameplay authority.
const botWaveDir = fs.readdirSync('src/game/botWave');
assert.deepEqual(botWaveDir.filter(f => f.endsWith('.js')), [],
  'src/game/botWave must not contain gameplay-logic modules (CSS entry only); production authority lives in public/game/bot-wave + the game.html pilot');
for (const f of fs.readdirSync('tools').filter(f => f.endsWith('.mjs'))) {
  const src = fs.readFileSync('tools/' + f, 'utf8');
  assert.ok(!/from\s+['"][^'"]*src\/game\/botWave\/[^'"]*\.js['"]/.test(src),
    f + ' imports a src/game/botWave logic twin');
}
console.log('BOXE BOT WAVE director PASS: production campaign authority, 80 golden wave plans bit-identical, cluster arc/boss/reveal law, no src twin');
