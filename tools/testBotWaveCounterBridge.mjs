// BOT WAVE counter regression: native Arsenal hits taken during Gold guard
// must project into the Gold guard/counter outcome at the bridge damage
// seam. Before the fix, wave enemies fired ONLY native Arsenal projectiles
// (Gold orbs are disabled with shootT=1e8), those hits called
// proxy.takeDamage -> engine.damagePlayer with no guard check and no Gold
// source identity, so the unlocked K counter could never strike and the
// guard did not even block. This boots the REAL bridge in a VM with stub
// Gold engine + stub native weapon API at their exact contracts; no bullet,
// collision or damage number is reimplemented here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const win = {};
win.window = win;
const context = vm.createContext({ window: win, console, Math, Date, WeakMap, Map, Set });
vm.runInContext(
  fs.readFileSync('public/game/bot-wave/nativeArsenalGoldBridge.js', 'utf8'),
  context,
  { filename: 'nativeArsenalGoldBridge.js', timeout: 4000 },
);
assert.ok(win.APEX_BOT_WAVE_NATIVE_BRIDGE, 'native bridge did not register');

const campaign = {
  indexNative: () => ({
    records: [{ id: 'PISTOL', spec: { shots: 3 }, family: 'SEMI', role: 'qa' }],
    allWeaponIds: ['PISTOL'],
  }),
};
const config = { WEAPONS: { TOWER_SHIELD: { damageTakenMult: 0.5 } } };

function makeWorld() {
  const calls = { damage: [], counter: [], cues: [], flash: 0 };
  const player = { id: 1, x: 0, y: 120, r: 30, hp: 1000, vx: 0, vy: 0, guardT: 0, counterDone: false };
  const engine = {
    player,
    waveCounterUnlocked: false,
    actx: null,
    damagePlayer(amount) { calls.damage.push(amount); player.hp -= amount; },
    damageEnemy() {},
    counterStrike(src) { calls.counter.push(src); player.guardT = 0; player.counterDone = true; },
    fx: { flash() { calls.flash += 1; } },
    combatCue(name) { calls.cues.push(name); },
    material: { dust() {} },
    initAudio() {},
  };
  const armory = win.APEX_BOT_WAVE_NATIVE_BRIDGE.createArmory({
    engine, config, campaign, cue() {}, rand: () => 0.5,
  });
  const holders = new Map();
  win.APEX_ARSENAL.weaponApi = {
    getHolder: (p) => holders.get(p) || null,
    equip: (p, id) => { holders.set(p, { weaponId: id }); return true; },
    consume() {}, updateHolder() {}, updateArsenalProjectiles() {},
    drawArsenalProjectiles() {}, drawArsenalVisuals() {}, tickVisuals() {},
    syncWeaponEmitter: () => true,
  };
  win.APEX_ARSENAL_WEAPONS = { PISTOL: {} };
  win.APEX_ARSENAL_AV = {
    cue() {}, preload() {}, tick() {}, draw() {}, clear() {},
    drawEquippedWeapon: () => false,
  };
  armory.connect();
  const goldEnemy = {
    id: 7, x: 300, y: 120, r: 30, hp: 380, dead: false,
    waveGunId: 'PISTOL', waveReloadT: 0,
  };
  const enemyProxy = armory.activate(goldEnemy);
  const playerProxy = win.fighters[0];
  assert.equal(playerProxy.__goldActor, player, 'player proxy must name its Gold actor');
  assert.equal(enemyProxy.__goldActor, goldEnemy, 'enemy proxy must name its Gold actor');
  return { engine, player, calls, playerProxy, enemyProxy, goldEnemy };
}

// 1. Unlocked counter: a native hit during guard counterstrikes the living
// Gold shooter and deals no player damage.
{
  const w = makeWorld();
  w.engine.waveCounterUnlocked = true;
  w.player.guardT = 1.2;
  w.playerProxy.takeDamage(80, w.enemyProxy, 'arsenal-pistol', false);
  assert.equal(w.calls.counter.length, 1, 'counterstrike must fire once');
  assert.equal(w.calls.counter[0], w.goldEnemy, 'counterstrike target must be the Gold enemy, not the proxy');
  assert.equal(w.calls.damage.length, 0, 'countered hit must not damage the player');
  assert.equal(w.player.hp, 1000);
}

// 2. Locked card: the same hit is a plain guard block (no strike, no damage).
{
  const w = makeWorld();
  w.engine.waveCounterUnlocked = false;
  w.player.guardT = 0.4;
  w.playerProxy.takeDamage(80, w.enemyProxy, 'arsenal-pistol', false);
  assert.equal(w.calls.counter.length, 0, 'locked counter must not strike');
  assert.equal(w.calls.damage.length, 0, 'guard must block native damage');
  assert.ok(w.calls.cues.includes('GUARD_HIT'), 'guard block cue expected');
  assert.equal(w.player.hp, 1000);
}

// 3. No guard: ordinary native damage path is untouched.
{
  const w = makeWorld();
  w.engine.waveCounterUnlocked = true;
  w.player.guardT = 0;
  w.playerProxy.takeDamage(80, w.enemyProxy, 'arsenal-pistol', false);
  assert.equal(w.calls.counter.length, 0);
  assert.deepEqual(w.calls.damage, [80]);
  assert.equal(w.player.hp, 920);
}

// 4. Status ticks (burn) are not new attacks: they pass through guard.
{
  const w = makeWorld();
  w.engine.waveCounterUnlocked = true;
  w.player.guardT = 1.0;
  w.playerProxy.takeDamage(12, w.enemyProxy, 'arsenal-flame', true);
  assert.equal(w.calls.counter.length, 0, 'burn tick must not trigger counter');
  assert.deepEqual(w.calls.damage, [12]);
}

// 5. Dead source during guard: absorbed silently, exactly like Gold orbs.
{
  const w = makeWorld();
  w.engine.waveCounterUnlocked = true;
  w.player.guardT = 1.0;
  w.goldEnemy.dead = true;
  w.playerProxy.takeDamage(80, w.enemyProxy, 'arsenal-pistol', false);
  assert.equal(w.calls.counter.length, 0, 'dead source cannot be countered');
  assert.equal(w.calls.damage.length, 0, 'guard still absorbs the hit');
  assert.equal(w.player.hp, 1000);
}

console.log('PASS BOT WAVE counter bridge: unlocked native hit counterstrikes Gold source; locked guard blocks; unguarded/status paths unchanged');
