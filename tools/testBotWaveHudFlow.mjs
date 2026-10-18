import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const presentation = fs.readFileSync('public/game/bot-wave/botWavePresentationV2.js', 'utf8');
const presentationCss = fs.readFileSync('public/game/bot-wave/botWavePresentationV2.css', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const wrapper = fs.readFileSync('public/bot-wave/index.html', 'utf8');

function sliceBetween(startNeedle, endNeedle, label) {
  const start = game.indexOf(startNeedle);
  const end = game.indexOf(endNeedle, start);
  assert.ok(start >= 0 && end > start, `${label} not found`);
  return game.slice(start, end);
}

const helperText = sliceBetween('function formatHudInt', '\nfunction refreshUI()', 'HUD helpers');
const guardText = sliceBetween('const GUARD_BASE_CD=', '\nfunction act(', 'guard state machine');
const actText = sliceBetween('function act(', '\nfunction activeGuns()', 'act()');
const transitionText = sliceBetween('function waveClearTransitionUI', '\nfunction lose()', 'wave transition');
const updateText = sliceBetween('function updateWave(', '\nfunction recordBOXERealDamage', 'updateWave()');

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force === undefined) force = !this.values.has(name);
    if (force) this.values.add(name); else this.values.delete(name);
    return force;
  }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}
function fakeElement() {
  return {
    textContent: '',
    hidden: false,
    disabled: false,
    title: '',
    dataset: {},
    style: { vars: {}, setProperty(name, value) { this.vars[name] = value; } },
    classList: new FakeClassList(),
    setAttribute(name, value) { this[name] = value; },
  };
}
function fakeButton(act) {
  const button = fakeElement();
  const small = fakeElement();
  const cdText = fakeElement();
  button.dataset.act = act;
  button.querySelector = (selector) => selector === 'small' ? small : selector === '.w-cd-text' ? cdText : null;
  button.small = small;
  button.cdText = cdText;
  return button;
}

const buttons = ['J', 'K', 'L', 'U', 'I'].map(fakeButton);
let startCalls = 0;
let refreshCalls = 0;
let armoryResets = 0;
let basicCalls = 0;
let counterCasts = 0;
const snapshots = [];
const sandbox = {
  Math,
  performance,
  document: {
    querySelectorAll(selector) { return selector === '[data-act]' ? buttons : []; },
    querySelector() { return null; },
  },
  UI: { 'wave-modal': fakeElement() },
  lastUI: 0,
  state: {
    wave: 3,
    phase: 'combat',
    queue: [],
    levelsPending: 0,
    offer: null,
    owned: new Set(),
    punchMul: 1,
    dashCdMul: 1,
    skillCdMul: 1,
    guardBonus: 0.16,
    counterWindowBonus: 0,
    guardHeld: false,
    guardCounterLive: false,
    guardHoldT: 0,
    guardCdT: 0,
    guardCdMax: 2.4,
    nextWaveT: 0,
    autoNextWave: false,
    waveToast: '',
    waveToastT: 0,
    comboFlow: {},
    rocketPending: true,
    healthPacks: [{ x: 0, y: 0 }],
  },
  engine: {
    time: 0,
    paused: false,
    banner: null,
    enemies: [],
    cds: new Map(),
    mouse: { down: false },
    player: {
      x: 0, y: 120, hp: 500, maxHp: 1000,
      guardT: 0, counterDone: true, basicCd: 0, dashCd: 0,
    },
    fx: { flash() {} },
    initAudio() {},
    sfx() {},
    combatCue() {},
    basicAttack() { basicCalls++; },
    dash() {},
    castSkill(id) {
      if (id !== 'counter') return false;
      counterCasts++;
      this.cds.set('counter', 12 * sandbox.state.skillCdMul);
      this.player.guardT = 1.6;
      this.player.counterDone = false;
      return true;
    },
  },
  ARMORY: { reset() { armoryResets++; } },
  ARENA_STAGE: { notice() {} },
  autoAimNow() {},
  activeGuns() { return 0; },
  activePressure() { return 0; },
  gunFire() {},
  makeEnemy() {},
  updateHealthPacks() {},
  refreshUI() { refreshCalls++; },
  waveComposition() { return { heal: 0.10, plan: { boss: false } }; },
  captureBoundarySnapshot(wave) { snapshots.push(wave); },
  startWave() {
    startCalls++;
    sandbox.state.phase = 'combat';
    sandbox.state.autoNextWave = false;
    sandbox.state.nextWaveT = 0;
  },
  lose() {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`
${helperText}
${guardText}
${actText}
${transitionText}
${updateText}
globalThis.__api={formatHudInt,formatCombatText,guardCooldownSnapshot,resetGuardState,beginGuard,finishGuard,updateGuard,act,completeWave,updateWave,GUARD_BASE_CD,GUARD_COUNTER_CD,GUARD_MOVE_MUL};
`, sandbox);
const api = sandbox.__api;
const state = sandbox.state;
const engine = sandbox.engine;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`);

// Display hygiene is presentation-only: exact internal values may remain
// fractional, but a player never sees -31.5-style combat text.
assert.equal(api.formatCombatText('-31.5'), '-32');
assert.equal(api.formatCombatText('31.5'), '32');
assert.equal(api.formatCombatText('+100.4 HP'), '+100 HP');
assert.equal(api.formatCombatText('K.O.!'), 'K.O.!');
assert.equal(api.formatHudInt(1254.4), '1,254');

// Basic K now exists before any Counter card: hold refreshes the Gold guard
// window, release is the event that starts the visible cooldown.
api.act('K', true);
assert.equal(state.guardHeld, true);
assert.equal(state.guardCounterLive, false);
near(engine.player.guardT, 0.12, 'basic guard opens immediately');
engine.player.guardT = 0.01;
api.updateGuard(0.05);
near(engine.player.guardT, 0.12, 'held K refreshes guard instead of using a fixed tap duration');
api.act('K', false);
assert.equal(state.guardHeld, false);
near(engine.player.guardT, 0.16, 'guard card bonus becomes release linger');
assert.ok(state.guardCdT >= api.GUARD_BASE_CD, 'basic guard must cool down after release');
assert.ok(buttons[1].classList.contains('is-cooling'), 'K button must expose its cooldown sweep');
api.act('K', true);
assert.equal(state.guardHeld, false, 'cooling K cannot reopen early');
assert.match(state.waveToast, /HỒI CHIÊU/);
api.updateGuard(4);
near(state.guardCdT, 0, 'basic guard cooldown expires');
api.act('K', true);
assert.equal(state.guardHeld, true);
api.act('J', true);
assert.equal(state.guardHeld, false, 'attacking commits out of guard');
assert.ok(state.guardCdT > 0, 'attack-cancelled guard still recovers');
assert.equal(basicCalls, 1);

// Golden Counter remains a one-hit stance. Holding K cannot farm repeated
// counterstrikes: consumption ends the stance and restarts the full CD.
state.owned.add('counter');
state.counterWindowBonus = 0.25;
state.skillCdMul = 0.93;
state.guardCdT = 0;
engine.cds.set('counter', 0);
api.act('K', true);
assert.equal(counterCasts, 1);
assert.equal(state.guardCounterLive, true);
assert.equal(engine.player.counterDone, false);
engine.player.counterDone = true; // Gold counterStrike consumed the stance.
engine.player.guardT = 0;
api.updateGuard(0.016);
assert.equal(state.guardHeld, false, 'a consumed counter ends even if K is still physically held');
near(engine.cds.get('counter'), 12 * 0.93, 'counter cooldown restarts at consumption');
near(state.guardCdT, 12 * 0.93, 'HUD cooldown mirrors the real counter cooldown');
state.guardCdT = 0;
engine.cds.set('counter', 0);
api.act('K', true);
api.act('K', false);
near(engine.player.guardT, 0.41, 'release linger keeps guard + counter-window bonuses');
assert.equal(engine.player.counterDone, false, 'unconsumed counter may still resolve its Gold expiry behaviour during linger');

// Wave clear preserves heal + next-boundary persistence, but the ordinary
// per-wave modal/pause/click has been removed from the flow.
api.resetGuardState();
state.phase = 'combat';
state.wave = 3;
state.autoNextWave = false;
engine.player.hp = 500;
engine.paused = true;
sandbox.UI['wave-modal'].hidden = false;
api.completeWave();
assert.equal(state.phase, 'intermission');
assert.equal(state.autoNextWave, true);
near(state.nextWaveT, 2.2, 'normal wave breather');
assert.equal(engine.paused, false, 'wave clear must not pause the arena');
assert.equal(sandbox.UI['wave-modal'].hidden, true, 'wave clear must not open the modal');
assert.deepEqual(snapshots, [4]);
near(engine.player.hp, 600, 'between-wave heal remains applied once');
assert.equal(armoryResets, 1, 'stray native projectiles clear at the seamless boundary');
assert.match(engine.banner.sub, /\+100 HP/);
for (let i = 0; i < 20; i++) api.updateWave(0.05);
assert.equal(startCalls, 0);
near(state.nextWaveT, 1.2, 'breather counts down in-world');
for (let i = 0; i < 24; i++) api.updateWave(0.05);
assert.equal(startCalls, 1, 'next wave starts automatically');
state.phase = 'intermission';
state.autoNextWave = false;
state.nextWaveT = 0;
api.updateWave(1);
assert.equal(startCalls, 1, 'intro/manual intermission cannot auto-start without the wave-clear flag');
assert.ok(refreshCalls > 0);

// Shipped seams: if a future refactor restores the modal or tap-only K, this
// gate fails even when the extracted functions above are left orphaned.
for (const required of [
  "engine.addText=function(x,y,text,color,size){return nativeAddText(x,y,formatCombatText(text),color,size);};",
  'data-act="K" data-key="K"',
  'class="w-cd"',
  "if(k==='K'&&!press){finishGuard('release');return;}",
  "['KeyJ','KeyK','KeyL','KeyU','KeyI'].includes(e.code)",
  'b.setPointerCapture(e.pointerId)',
  "b.addEventListener('lostpointercapture'",
  'state.guardHeld?GUARD_MOVE_MUL:1',
  'engine.paused=false;state.autoNextWave=true;state.nextWaveT=waveClearTransitionUI(c,healed);',
  "if(state.nextWaveT<=0&&!state.levelsPending&&!state.offer)startWave();",
]) assert.ok(game.includes(required), `Missing HUD/guard seam: ${required}`);
assert.ok(!game.includes('function completedUI('), 'per-wave completed modal is retired');
assert.ok(!game.includes("UI['w-go'].textContent='▶ NEXT WAVE"), 'ordinary waves must not wait for NEXT WAVE click');
assert.ok(!game.includes("engine.player.guardT=.45+state.guardBonus"), 'fixed .45s tap guard is retired');

for (const required of [
  "const VERSION='owner-release-r10-seamless-hud';",
  'for(let i=0;i<10;i++)',
  'Math.floor((n-1)/10)+1,beat=(n-1)%10,bossBeat=beat===9',
  'Number(s.pressureBudget)',
  'Number(e.wavePressure)',
  "s.autoNextWave?'WAVE CLEAR'",
  'window.setInterval(update,90)',
]) assert.ok(presentation.includes(required), `Missing V2 HUD truth seam: ${required}`);
assert.ok(!presentation.includes('Math.floor((n-1)/5)'), 'stale five-wave chapter math is retired');
assert.ok(!presentation.includes('beat===4'), 'stale fifth-wave boss math is retired');

for (const required of [
  '#wave-hud .w-action .w-cd',
  'conic-gradient(rgba(1,5,9,.74)',
  '#wave-hud .w-action[data-act="K"].is-guarding',
  '#wave-hud #wave-status[data-kind="toast"]',
  '#wave-hud .bw-is-clear #bw-pressure-fill',
  '#wave-hud #w-wave{display:none!important}',
]) assert.ok(presentationCss.includes(required), `Missing V2 HUD CSS seam: ${required}`);
assert.ok(!presentationCss.includes('#wave-hud #wave-status{display:none!important}'), 'contextual status feed must be visible');

assert.ok(app.includes('botWavePresentationV2.css?v=20261018-botwave-hud-r10'));
assert.ok(app.includes('botWavePresentationV2.js?v=20261018-botwave-hud-r10'));
assert.ok(wrapper.includes('botWavePresentationV2.css?v=20261018-botwave-hud-r10'));
assert.ok(wrapper.includes('botWavePresentationV2.js?v=20261018-botwave-hud-r10'));

console.log('BOT WAVE HUD flow PASS: seamless waves, integer presentation, hold-K guard + pre-counter cooldown, 10-wave pressure HUD');
