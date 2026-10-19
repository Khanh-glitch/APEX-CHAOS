import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const campaign = fs.readFileSync('public/game/bot-wave/waveCampaign.js', 'utf8');
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
  "hudBeatId:'farm',hudBeatIndex:0,hudPattern:'front',hudNewWeapons:[]",
  'state.queue=comp.plan.composition.map(e=>({gun:e.weaponId,family:e.family,boss:e.boss,edge:e.edge,',
  'state.hudBeatId=comp.plan.beat;state.hudBeatIndex=(comp.plan.clusterWave||1)-1;state.hudPattern=comp.plan.pattern||',
  "waveGunId:desc.gun,waveFamily:desc.family||'',waveRole:desc.role||'',waveEdge:edge",
  'state.waveDamageDealt=(state.waveDamageDealt||0)+done;',
  'state.waveKills=(state.waveKills||0)+1;',
  'const sourceAngle=Number.isFinite(fromAngle)?fromAngle+Math.PI:0;',
  'state.lastDamageAt=engine.time;state.lastDamageAngle=sourceAngle;state.lastDamageAmount=realized;',
  'clusterWave=(wave-1)%10,boss=clusterWave===9',
  'const gateLoad=[0,0,0,0],gateCount=[0,0,0,0];',
  'gateLoad[i]+=.34+(q.pressure||0)/260+(q.boss?1.4:0);',
  'const radial=Math.min(1,Math.hypot(e.x||0,e.y||0)/650);',
  'gateLoad[i]+=(.22+(e.wavePressure||0)/300+(e.waveBoss?1.2:0))*radial;',
  'state.lastHealAt=engine.time;state.lastHealAmount=healed;',
  'beat:{id:state.hudBeatId,index:state.hudBeatIndex,pattern:state.hudPattern,newWeapons:[...state.hudNewWeapons]}',
  'const nextBeat=CAMPAIGN.beats?.[(snap.wave-1)%10];state.hudBeatId=nextBeat?.id||',
  'const BOT_WAVE_CAMERA_ZOOM=1.75;',
  'this.camZoom=(this.camZoom||.5)/BOT_WAVE_CAMERA_ZOOM;',
  'this.camZoomBase=(this.camZoomBase||.5)*BOT_WAVE_CAMERA_ZOOM;',
  'this.camZoom=(this.camZoom||this.camZoomBase)*BOT_WAVE_CAMERA_ZOOM;',
  'engine.camZoom=.875;engine.camZoomBase=.875;',
  'desiredBaseScale(){return (engine.dpr||1)>1.05?1.85:1;}',
  'c.width=c.height=2200*scale;',
  'ctx.drawImage(this.base,-1100,-1100,2200,2200);',
  'setPaused:(value)=>{',
  'saveAndExit:()=>{',
  "const detail={type:'APEX_BOT_WAVE_EXIT',saved,wave};",
  'window.parent.postMessage(detail,window.location.origin);',
  'replayWave:()=>{',
  'replayCluster:()=>{',
  'restartRun:()=>{restart();return true;},',
  'xpNeeded:(level)=>xpNeeded(level)',
  'const gateGlow=ctx.createLinearGradient(-w/2,0,w/2,0);',
  'const damageGradient=ctx.createLinearGradient(0,-large*.58,0,large*.58);',
  'const koSize=p.boss?49:31,koGradient=ctx.createLinearGradient',
]) assert.ok(game.includes(required), `Missing HUD/guard seam: ${required}`);
assert.ok(!game.includes('function completedUI('), 'per-wave completed modal is retired');
assert.ok(!game.includes("UI['w-go'].textContent='▶ NEXT WAVE"), 'ordinary waves must not wait for NEXT WAVE click');
assert.ok(!game.includes("engine.player.guardT=.45+state.guardBonus"), 'fixed .45s tap guard is retired');

for (const required of [
  "const VERSION='owner-release-r16-ironworks-final';",
  'for(let i=0;i<10;i++)',
  'Math.floor((n-1)/10)+1,beat=Number.isInteger(s.hudBeatIndex)',
  'beatInfo=BEATS[beat]||beatForWave(n),bossBeat=beat===9',
  'Number(s.pressureBudget)',
  'Number(e.wavePressure)',
  "s.autoNextWave?'WAVE CLEAR'",
  'window.setInterval(update,90)',
  'const ACTION_GLYPHS=Object.freeze({',
  'const ACTION_LOCK_GLYPH=',
  'installActionGlyphs(actions);',
  "decor(center,'bw-spine-frame'",
  "decor(threat,'bw-minimap-armor'",
  "decor(skill,'bw-skill-dock'",
  "event.animationName==='bw-action-deploy'",
  "button.classList.add('bw-deployed')",
  'const syncActionMotion=()=>{',
  "button.dataset.motionState=disabled?'locked'",
  "flashAction(button,'bw-unlock-flash',950,'unlockTimer')",
  "flashAction(button,'bw-ready-flash',680,'readyTimer')",
  'const placedMarkers=[];',
  'const below=Math.max(...blockers.map(rect=>rect.bottom))+22',
  'const pulseHeroHit=()=>{',
  'if(lastHeroHp!=null&&hpNow<lastHeroHp-1&&hpNow>0)pulseHeroHit();',
  'const sweepAngle=prefersReducedMotion?null:(time*1.45)%(Math.PI*2);',
  'const pingAge=((sweepAngle-Math.atan2(e.y||0,e.x||0))%(Math.PI*2)+Math.PI*2)%(Math.PI*2);',
  "decor(deck,'bw-atmosphere'",
  "decor(hero,'bw-forge-shell'",
  "decor(vitalStack,'bw-forge-backlight'",
  "forgeFireCanvas.id='bw-fire-canvas';",
  "forgeParticleCanvas.id='bw-ember-canvas';",
  'vitalStack.append(forgeFireCanvas,forgeParticleCanvas);',
  'function createForgeFire(glCanvas,particleCanvas,reducedMotion){',
  "state.mode='webgl-fbm-domain-warp';",
  'float fbm(vec2 p)',
  'vec2 warpB=vec2(fbm',
  'vec3 fireRamp(float t)',
  'tongueHeight=clamp(tongueHeight,0.012,0.68);',
  'const fill=clamp(fury),heat=fill<=.08?0:clamp((fill-.08)/.92);',
  'state.emberSpawn+=dt*(gl?7:12)*intensity;',
  "spawn('ember'",
  "spawn('smoke'",
  'forgeFire.render({fury:s.empowered?1:clamp((Number(s.passiveProgress)||0)/300),hp:hpPct});',
  'fireRenderer:()=>forgeFire.mode,',
  'const minimapTrail=[];',
  "marker.dataset.urgency=entry.kind==='boss'||entry.distance<430?'critical'",
  "pulseDeck('bw-event-wave',980);",
  "pulseDeck('bw-event-level',1150);",
  "pulseDeck('bw-event-boss',1250);",
  "pulseDeck('bw-event-ignite',1100);",
  "decor(pressure,'bw-pressure-ticks'",
  "center.dataset.presentation='paneless-crest';",
  'const CARD_SIGILS=Object.freeze({',
  'const decorateUpgradeCards=()=>{',
  'cardObserver?.disconnect?.();',
  "chip.dataset.code=CARD_CODES[id]||'APX';",
  "decor(modal,'bw-dialog-ornaments'",
  "center.dataset.danger=danger>=.82?'critical'",
  'syncActionMotion();',
  'const BEATS=Object.freeze([',
  "name:'DAWN HARVEST'",
  "name:'CROSS LESSON'",
  "name:'GOLD HARVEST'",
  "name:'LAST BELL'",
  'function refreshScreenFrame(layer){',
  'const refreshArenaType=(attempt=0)=>{',
  "doc.fonts.load('700 32px \"ApexVietCondensed\"','APEX')",
  'if(stage&&loaded>=2){stage.base=null;return;}',
  'function worldToScreen(x,y){',
  "levelCore.id='bw-level-core';",
  "vitalStack.id='bw-vital-stack';",
  "pause.classList.add('bw-pause-trigger');",
  "beatCard.id='bw-beat-card';",
  "oracle.id='bw-oracle';",
  "threat.id='bw-minimap';",
  "minimapCanvas.id='bw-minimap-canvas';",
  "dataVault.append(right);",
  "skill.setAttribute('aria-label','Kỹ năng chiến đấu của BOXE');",
  "status.classList.add('bw-event-ticker');",
  "pauseMenu.id='bw-pause-menu';",
  "spatial.id='bw-spatial-layer';",
  "const peripheral=node('div','bw-peripheral');",
  'bw-marker-arrow',
  'bw-marker-badge',
  'bw-marker-copy',
  'bw-marker-meter',
  '--bw-marker-arrow-x',
  'deck.dataset.focus=focus;',
  "hpPct<=.35&&player.hp>0?'danger'",
  "oracle.classList.toggle('is-open',focus==='breather');",
  'const forecastWave=breather?(Number(s.wave)||0)+1:n;',
  'forecastCache=nextWavePlan(pilot,forecastWave)',
  'const queuedPressure=(s.queue||[]).reduce',
  "pressure.style.setProperty('--bw-inbound-pressure'",
  "marker.dataset.family=entry.family||'';",
  'function xpThreshold(pilot,level){',
  "levelCore.style.setProperty('--bw-xp',xpPct.toFixed(3));",
  "hero.classList.toggle('bw-is-ignited',ignited);",
  'const ARENA_RADIUS=920;',
  'const drawMinimap=(lab,s,live)=>{',
  'const hostileGroups=new Map();',
  'const sector=((Math.round(angle/(Math.PI/6))%12)+12)%12;',
  'const syncPauseMenu=()=>{',
  'const setPauseFromInterface=open=>{',
  'pause.onclick=event=>{event.preventDefault();setPauseFromInterface(!window.handLab?.paused);};',
  "if(action==='save-exit'){",
  "if(action==='replay-wave')pilot?.replayWave?.();",
  "else if(action==='replay-cluster')pilot?.replayCluster?.();",
  "else if(action==='restart-run')pilot?.restartRun?.();",
  'openPauseMenu:()=>setPauseFromInterface(true)',
  'spatialFrame=window.requestAnimationFrame(spatialLoop);',
  "window.cancelAnimationFrame?.(spatialFrame)",
]) assert.ok(presentation.includes(required), `Missing V2 HUD truth seam: ${required}`);
assert.ok(!presentation.includes('Math.floor((n-1)/5)'), 'stale five-wave chapter math is retired');
assert.ok(!presentation.includes('beat===4'), 'stale fifth-wave boss math is retired');
assert.ok(!presentation.includes('bw-portrait'), 'vitality reactor replaces the avatar slot');
assert.ok(!presentation.includes('bw-radar'), 'decorative mini-radar is replaced by the true arena minimap');
assert.ok(!presentation.includes('bw-constellation'), 'family constellation leaves the top-right minimap surface');
assert.ok(!presentation.includes('bw-telemetry'), 'telemetry panel leaves the top-right minimap surface');
assert.ok(!presentation.includes('bw-damage-wedge'), 'presentation must not draw a damage circle around BOXE');
assert.ok(!presentation.includes('bw-heal-halo'), 'presentation must not draw a heal circle around BOXE');
assert.ok(!presentation.includes('time*.018'), 'minimap compass ticks must stay fixed while only the radar sweep rotates');

for (const required of [
  'BOT WAVE R16 — Ironworks Command / Relic Draft',
  "@import url('/gold/fonts.css');",
  "@font-face{font-family:'ApexVietCondensed';src:url('/gold/fonts/apex-oswald-vietnamese.ttf')",
  '--bw-font-display:"ApexVietCondensed","Oswald","Segoe UI",system-ui,sans-serif;',
  '--bw-font-data:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace;',
  '#wave-hud .bw-spatial-layer',
  '#wave-hud .bw-spatial-marker.is-boss',
  '#wave-hud .bw-marker-arrow',
  '#wave-hud .bw-marker-badge',
  '#wave-hud .bw-marker-copy strong',
  '#wave-hud .bw-marker-meter',
  '#wave-hud .bw-peripheral',
  '#wave-hud .bw-momentum',
  '#wave-hud .bw-level-core',
  'conic-gradient(from -90deg,#dff9ff 0deg,#8fe8ff calc(var(--bw-xp)*1turn)',
  '#wave-hud .bw-vital-stack',
  '#wave-hud .bw-native-level-copy,#wave-hud .w-meter.xp{display:none!important}',
  '#wave-hud .bw-hero.bw-is-ignited',
  '#wave-hud .bw-forge-shell',
  '#wave-hud .bw-forge-backlight',
  'opacity:calc(var(--bw-fury)*.38)',
  'height:28px;width:100%',
  '#wave-hud .bw-fire-canvas',
  '@keyframes bw-fury-flow',
  '#wave-hud .bw-ember-canvas',
  '--bw-metal-text:linear-gradient(180deg,#fffdf4 0%,#ffe9b8 38%,#d89c58 62%,#fff0bd 82%,#9a6336 100%);',
  '--bw-fire-deep:#3d0500;--bw-fire-red:#b91f05;--bw-fire:#ff5a00;--bw-fire-gold:#ffb52e;--bw-fire-white:#fff3b0;',
  '#wave-hud .bw-command-deck.bw-event-wave .bw-paneless-crest',
  '#wave-hud .bw-command-deck.bw-event-level .bw-level-core',
  '#wave-hud .bw-command-deck.bw-event-boss .bw-minimap',
  '#wave-hud .bw-command-deck.bw-event-ignite .bw-fire-canvas',
  '#wave-hud .bw-spatial-marker[data-urgency="critical"]:before',
  '@keyframes bw-boss-lava',
  '@keyframes bw-event-ignite-fire',
  '@keyframes bw-marker-reticle',
  '#wave-hud .bw-pause-trigger',
  '#wave-hud .bw-pause-menu',
  '#wave-hud .bw-pause-actions .is-confirming',
  '#wave-hud .bw-paneless-crest:before',
  '#wave-hud .bw-wave-core',
  '#wave-hud .bw-spine-frame',
  '#wave-hud .bw-wave-core:before{content:"";position:absolute;inset:3px',
  '#wave-hud .bw-minimap-armor',
  '#wave-hud .bw-skill-dock',
  '#wave-hud .bw-action-lock',
  '#wave-hud .w-action.bw-deployed{animation:none}',
  '#wave-hud .w-action.bw-unlock-flash',
  '@keyframes bw-spine-charge',
  '@keyframes bw-hero-hit',
  '@keyframes bw-action-deploy',
  '#wave-hud .bw-beat-inline strong',
  '#wave-hud .bw-oracle.is-open',
  '#wave-hud .bw-minimap-canvas',
  '#wave-hud .bw-minimap[data-danger="critical"]',
  '#wave-hud .bw-data-vault{display:none!important}',
  '#wave-hud .bw-command-deck[data-focus="hot"] .bw-encounter',
  '#wave-hud .bw-command-deck[data-focus="danger"] .bw-minimap',
  '#wave-hud .bw-command-deck[data-focus="breather"] .bw-encounter',
  '#wave-hud .bw-command-deck[data-focus="cinematic"] .bw-top',
  '#wave-hud [data-family="PRECISION"]',
  '--bw-brass:#c99a5f;--bw-bronze:#8a5a34;--bw-amber:#ffbb71;--bw-gold:#ffe1a1;--bw-ember:#ff7048',
  '--bw-crimson:#ff4057;--bw-mint:#8dffb2;--bw-cyan:#8fe8ff;--bw-violet:#c9a7ff',
  '#wave-hud .bw-atmosphere',
  '#wave-hud .bw-pressure-ticks',
  '#wave-hud .bw-action-glyph',
  'flex-direction:row!important',
  '#wave-hud .w-action[data-act="I"]{order:1;',
  '#wave-hud .w-action[data-act="U"]{order:2;',
  '#wave-hud .w-action[data-act="J"]{order:3;',
  '#wave-hud .w-action[data-act="K"]{order:4;',
  '#wave-hud .w-action[data-act="L"]{order:5;',
  'width:104px!important;height:104px!important',
  'top:calc(100% + 12px)',
  'top:calc(100% + 35px)',
  '--bw-action-accent:#ffcf7a',
  '--bw-action-accent:#8fe8ff',
  '--bw-action-accent:#c9a7ff',
  '--bw-action-accent:#ff5964',
  '#wave-hud .w-action .w-cd',
  'conic-gradient(from -90deg,rgba(1,4,8,.88)',
  '#wave-hud .w-action.bw-ready-flash',
  '#wave-hud .w-action[data-act="K"].is-guarding',
  '#wave-hud #wave-status[data-kind="toast"]',
  '#wave-hud .bw-is-clear #bw-pressure-fill',
  '#wave-hud #w-wave,#wave-hud #w-arsenal{display:none!important}',
  '#arena-experience-hud #r2-boss-panel{top:94px!important;',
  '#arena-experience-hud #r2-boss-panel .boss-r2-meter:after',
  '#wave-modal .w-dialog>.bw-dialog-ornaments',
  '#wave-modal .w-dialog .bw-relic-card[data-tier="LEGENDARY"]',
  '#wave-modal .w-dialog .bw-card-sigil',
  '#wave-modal .w-dialog .bw-card-value',
  '#wave-modal .w-dialog .bw-card-footer',
  'content:attr(data-choice)',
  '#wave-modal .w-dialog .bw-card-sigil svg',
  '@keyframes bw-draft-halo',
  '@keyframes bw-card-deal',
  'background:transparent;border:0;box-shadow:none;clip-path:none;backdrop-filter:none',
  '@media(prefers-reduced-motion:reduce)',
]) assert.ok(presentationCss.includes(required), `Missing V2 HUD CSS seam: ${required}`);
assert.ok(!presentationCss.includes('#wave-hud #wave-status{display:none!important}'), 'contextual status feed must be visible');
assert.ok(!presentation.includes('bw-ignition'), 'CSS teardrop ignition is replaced by the in-bar forge renderer');
assert.ok(!presentationCss.includes('.bw-damage-wedge'), 'damage-circle CSS must not return around BOXE');
assert.ok(!presentationCss.includes('.bw-heal-halo'), 'heal-circle CSS must not return around BOXE');
assert.ok(!presentationCss.includes('.bw-ignition'), 'CSS teardrop flame rules are retired');
assert.ok(!presentationCss.includes('.bw-portrait'), 'avatar CSS is retired with the vitality reactor');
assert.ok(!presentationCss.includes('.bw-radar'), 'mini-radar CSS is retired with the true minimap');
assert.ok(!presentationCss.includes('.bw-constellation'), 'constellation CSS leaves the minimap surface');
assert.ok(!presentationCss.includes('.bw-telemetry'), 'telemetry CSS leaves the minimap surface');
assert.ok(!presentationCss.includes('repeating-linear-gradient(0deg,transparent 0 3px'), 'full-screen scanlines must not blur the 1.75x Gold lens');
assert.ok(!presentationCss.includes('Bahnschrift'), 'Windows-only Bahnschrift fallback is retired');
assert.ok(!presentationCss.includes('Impact'), 'Impact fallback is retired in favour of shipped Vietnamese display fonts');
assert.ok(!/font:(?:italic\s+)?(?:800|850|900|950|1000)\s/.test(presentationCss), 'fake heavy font weights are retired');
assert.ok(!game.includes('boss=wave===5||wave===10'), 'arena boss lighting must follow the repeating ten-wave cluster');
assert.ok(fs.existsSync('public/gold/fonts.css'), 'BOT WAVE iframe must be able to load the shipped Oswald/Teko/JetBrains sheet');
assert.ok(fs.existsSync('public/gold/fonts/apex-oswald-vietnamese.ttf'), 'BOT WAVE must ship its Vietnamese condensed display face');
assert.ok(presentationCss.indexOf("@import url('/gold/fonts.css');") < presentationCss.indexOf('#wave-hud{'),
  'font import must precede HUD rules to be valid CSS');
assert.ok(game.includes('"ApexVietCondensed","Oswald",system-ui,sans-serif'), 'canvas combat type must use shipped Vietnamese display fonts');
assert.ok(game.includes('"JetBrains Mono",ui-monospace,monospace'), 'canvas data type must use the shipped mono face');

for (const required of [
  'pattern:beat.pattern',
  'families:Object.freeze(Object.entries(beat.familyWeights)',
  'familyWeights:Object.freeze({...beat.familyWeights})',
]) assert.ok(campaign.includes(required), `Missing campaign forecast seam: ${required}`);

// Execute the real V2 installer against a DOM shaped like the pilot HUD.
// This proves R16 is not just source decoration: the in-bar forge reactor,
// iron wave spine, relic draft, armored minimap, action-state motion,
// clustered spatial markers, pause system and breather oracle all react to
// live pilot/engine telemetry.
const r12dom = new JSDOM(`<!doctype html><html><head></head><body>
<div id="wave-hud">
  <div class="w-left">
    <div class="w-head">BOXE</div>
    <div class="w-small">HP <b id="w-hp">280 / 1,000</b></div>
    <div class="w-meter hp-r2"><div id="w-hp-trail"></div><i id="w-hp-bar"></i><div class="w-hp-shine"></div></div>
    <div class="w-fury-line"><span>✹ NHIỆT HUYẾT</span><b id="w-r2-fury-val">3s</b></div>
    <div class="w-meter fury-r2"><i id="w-r2-fury-bar"></i></div>
    <div class="w-small">LV <b id="w-level">3</b> · XP <b id="w-xp">35 / 95</b></div>
    <div class="w-meter xp"><i id="w-xp-bar"></i></div>
  </div>
  <div class="w-right"><b id="w-wave">WAVE 09</b><span id="w-count">3 HOSTILES LEFT</span>
    <div id="w-arsenal"><span>PISTOL</span><span>SNIPER</span></div></div>
  <div id="wave-status">J PUNCH</div><div id="wave-stick"><i></i></div>
  <div class="w-actions">
    <button data-act="J"><span class="w-action-key">J</span><small>PUNCH</small></button>
    <button data-act="K"><span class="w-action-key">K</span><small>GUARD</small></button>
    <button data-act="L"><span class="w-action-key">L</span><small>DASH</small></button>
    <button data-act="U"><span class="w-action-key">U</span><small>PHANTOM</small></button>
    <button data-act="I"><span class="w-action-key">I</span><small>FINAL</small></button>
  </div><button id="resume-wave">PAUSE</button>
</div>
<section id="wave-modal"><div class="w-dialog"><h1 id="w-title">BOT WAVE</h1><p id="w-desc">CHOOSE</p><div id="w-cards"><button class="w-card"><small>RARE · UNLOCK</small><strong>GOLDEN COUNTER</strong><em>Giữ K dựng phản đòn Gold; chặn trúng đòn sẽ phản công</em></button><button class="w-card"><small>COMMON · UPGRADE</small><strong>THIẾT QUYỀN</strong><em>+13% sức đấm, tăng sát thương cận chiến</em></button><button class="w-card"><small>LEGENDARY · UNLOCK</small><strong>CHAMPION FINAL · I</strong><em>Mở chiêu cuối từ Gold phím 0</em></button></div><button id="w-go">START</button></div></section>
</body></html>`, { url: 'http://localhost/bot-wave/game.html', pretendToBeVisual: false, runScripts: 'outside-only' });
const r12window = r12dom.window;
const r12state = {
  wave: 9, phase: 'combat', autoNextWave: false, nextWaveT: 0,
  hudBeatId: 'crescendo', hudBeatIndex: 8, hudPattern: 'four-edge', hudNewWeapons: [],
  queue: [{ gun: 'PISTOL', family: 'SEMI', edge: 'right', edgeFraction: 0.5, pressure: 52 }],
  spawnT: 0.08, spawnInterval: 0.34, softCap: 6, pressureBudget: 380,
  waveKills: 7, waveDamageDealt: 2450, waveDamageReceived: 310,
  level: 3, xp: 35, kills: 44, aliveTime: 125, stacks: { power: 2, jab: 1, fist: 2 },
  offer: [
    { id: 'counter', label: 'GOLDEN COUNTER', desc: 'Giữ K dựng phản đòn Gold; chặn trúng đòn sẽ phản công', tier: 'RARE' },
    { id: 'fist', label: 'THIẾT QUYỀN', desc: '+13% sức đấm, tăng sát thương cận chiến', tier: 'COMMON', max: 12 },
    { id: 'ult', label: 'CHAMPION FINAL · I', desc: 'Mở chiêu cuối từ Gold phím 0', tier: 'LEGENDARY' },
  ],
  waveSnapshot: { wave: 9 }, clusterSnapshot: { wave: 1 },
  passiveProgress: 300, passiveReady: false,
  healthPacks: [{ x: 120, y: 80 }], lastDamageAt: 11.8, lastDamageAngle: 0, lastDamageAmount: 120,
  lastHealAt: -9, lastHealAmount: 0, guardHeld: false, guardCdT: 0, empowered: true,
};
const r12plan = (wave) => ({ plan: {
  wave, pattern: wave === 10 ? 'four-edge' : 'cross',
  newWeapons: wave === 10 ? ['OMEGA'] : [],
  composition: [
    { weaponId: 'PISTOL', family: 'SEMI', role: 'fire' },
    { weaponId: 'SNIPER', family: 'PRECISION', role: 'snipe' },
    { weaponId: 'OMEGA', family: 'SPECIAL', role: 'signature' },
  ],
} });
let pauseCalls = 0;
let saveExitCalls = 0;
let restartRunCalls = 0;
r12window.BOXE_WAVE_PILOT = {
  state: r12state,
  planWave: r12plan,
  xpNeeded: (level) => Math.ceil(70 * Math.pow(1.16, level - 1)),
  setPaused(value) { pauseCalls++; r12window.handLab.paused = !!value; return true; },
  saveAndExit() { saveExitCalls++; return { saved: true, wave: r12state.waveSnapshot.wave }; },
  replayWave() { r12window.handLab.paused = false; return true; },
  replayCluster() { r12window.handLab.paused = false; return true; },
  restartRun() { restartRunCalls++; r12window.handLab.paused = false; return true; },
};
r12window.handLab = {
  time: 12, w: 960, h: 540, camZoom: 0.875, cam: { x: 0, y: 0 }, paused: false,
  canvas: r12window.document.createElement('canvas'),
  player: { x: 0, y: 0, hp: 280, maxHp: 1000, aim: -0.4 },
  enemies: [
    { x: 1600, y: -500, hp: 2250, maxHp: 3000, waveGunId: 'OMEGA', waveFamily: 'SPECIAL', waveBoss: true, wavePressure: 150 },
    { x: -1500, y: 300, hp: 180, maxHp: 240, waveGunId: 'SNIPER', waveFamily: 'PRECISION', waveBoss: false, wavePressure: 90 },
    { x: -1450, y: 280, hp: 160, maxHp: 220, waveGunId: 'AK47', waveFamily: 'AUTO', waveBoss: false, wavePressure: 55 },
  ],
  toScreen(x, y) { return { x: 480 + x * 0.875, y: 270 + y * 0.875 }; },
};
r12window.BOXE_ARENA_EXPERIENCE = { stage: { base: { stale: true } } };
Object.defineProperty(r12window.document, 'fonts', {
  configurable: true,
  value: { load: async () => [{ family: 'stubbed-loaded-face' }] },
});
r12window.document.getElementById('wave-modal').hidden = true;
r12window.eval(presentation);
const r12doc = r12window.document;
assert.equal(r12window.APEX_BOT_WAVE_INTERFACE_V2?.version, 'owner-release-r16-ironworks-final');
assert.equal(r12window.APEX_BOT_WAVE_INTERFACE_V2?.fireRenderer?.(), 'particle-fallback', 'JSDOM without WebGL must retain the pooled particle furnace');
assert.ok(r12doc.getElementById('bw-fire-canvas'), 'vitality reactor must own a dedicated procedural-fire canvas');
assert.ok(r12doc.getElementById('bw-ember-canvas'), 'vitality reactor must own an independent ember/smoke canvas');
assert.ok(r12doc.getElementById('bw-vital-stack')?.contains(r12doc.getElementById('bw-fire-canvas')), 'forge flame must be rooted inside the Nhiệt Huyết trough, not over the hero panel');
assert.equal(r12doc.querySelector('.bw-hero')?.dataset.fireRenderer, 'particle-fallback');
assert.equal(r12doc.querySelectorAll('.bw-action-glyph').length, 5);
assert.equal(r12doc.querySelectorAll('.bw-action-lock').length, 5, 'every socket needs a font-independent lock state');
assert.ok(r12doc.querySelector('.bw-spine-frame'), 'paneless wave state must hang from a mechanical spine frame');
assert.equal(r12doc.querySelectorAll('.bw-minimap-armor i').length, 8, 'minimap bezel needs eight physical bolts');
assert.ok(r12doc.querySelector('.bw-skill-dock'), 'skill sockets must seat into the iron console dock');
assert.equal(r12doc.querySelectorAll('.bw-spatial-marker').length, 9);
assert.equal(r12doc.querySelectorAll('.bw-portrait').length, 0, 'avatar must not be recreated');
assert.equal(r12doc.getElementById('bw-level-value')?.textContent, '3');
assert.equal(r12doc.getElementById('bw-xp-ring-label')?.textContent, '35 / 95 XP');
assert.ok(r12doc.getElementById('bw-vital-stack')?.contains(r12doc.getElementById('w-hp-bar')), 'native HP meter must move into the fused vitality stack');
assert.ok(r12doc.getElementById('bw-vital-stack')?.contains(r12doc.getElementById('w-r2-fury-bar')), 'native fury meter must be fused directly beneath HP');
assert.ok(r12doc.querySelector('.bw-hero')?.classList.contains('bw-is-ignited'), 'full fury must ignite the whole vitality reactor');
assert.ok(r12doc.getElementById('bw-minimap-canvas'), 'top-right must be a true minimap canvas');
assert.equal(r12doc.getElementById('bw-minimap-mode')?.textContent, 'BOSS');
assert.match(r12doc.getElementById('bw-minimap-next')?.textContent || '', /RIGHT · PISTOL/);
assert.ok(r12doc.querySelector('.bw-data-vault')?.contains(r12doc.getElementById('w-arsenal')), 'native arsenal nodes stay alive in the hidden data vault');
assert.ok(r12doc.querySelector('.bw-minimap-foot')?.contains(r12doc.getElementById('w-count')), 'native hostile count becomes the minimap footer');
assert.equal(r12doc.getElementById('bw-beat-name')?.textContent, 'APEX STORM');
assert.equal(r12doc.getElementById('bw-interface-v2')?.dataset.focus, 'danger');
assert.equal(r12doc.querySelectorAll('.bw-damage-wedge').length, 0, 'recent damage must not recreate a circle around BOXE');
assert.equal(r12doc.querySelectorAll('.bw-heal-halo').length, 0, 'healing must not recreate a circle around BOXE');
assert.equal(r12doc.querySelector('.bw-paneless-crest')?.dataset.presentation, 'paneless-crest', 'top-center wave state must be paneless');
assert.equal(r12doc.querySelector('.w-dialog')?.dataset.presentation, 'relic-draft', 'upgrade modal must use the relic draft presentation');
const relicCards = [...r12doc.querySelectorAll('.bw-relic-card')];
assert.equal(relicCards.length, 3, 'each live upgrade offer must become a relic tablet');
assert.equal(relicCards[0]?.dataset.kind, 'unlock');
assert.equal(relicCards[0]?.querySelector('.bw-card-value')?.textContent, 'GIỮ K · PHẢN ĐÒN');
assert.equal(relicCards[1]?.dataset.tier, 'COMMON');
assert.equal(relicCards[1]?.querySelector('.bw-card-value')?.textContent, '+13%');
assert.equal(relicCards[1]?.querySelector('.bw-card-footer')?.textContent, 'STACK 2 → 3 / 12');
assert.equal(relicCards[2]?.dataset.tier, 'LEGENDARY');
assert.ok(relicCards.every((card) => card.querySelector('.bw-card-sigil svg')), 'relic tablets need font-independent SVG emblems');
assert.ok(Number(r12doc.querySelector('.bw-peripheral')?.style.opacity) > 0, 'low HP must light the peripheral field');
assert.ok([...r12doc.querySelectorAll('.bw-spatial-marker')].some((marker) => marker.textContent.includes('OMEGA')), 'offscreen boss must receive a spatial marker');
assert.ok([...r12doc.querySelectorAll('.bw-spatial-marker')].some((marker) => marker.textContent.includes('SNIPER +1')), 'same-sector hostiles must cluster into one polished edge tag');
assert.ok([...r12doc.querySelectorAll('.bw-spatial-marker')].some((marker) => marker.style.getPropertyValue('--bw-marker-arrow-x').startsWith('-')),
  'left-side hostiles must place their direction chevron outside the tag on the true vector');
assert.ok([...r12doc.querySelectorAll('.bw-spatial-marker')].some((marker) => marker.dataset.urgency === 'critical'),
  'boss/close hostiles must escalate the reticle urgency state');
const finalButton = r12doc.querySelector('[data-act="I"]');
const dashButton = r12doc.querySelector('[data-act="L"]');
finalButton.disabled = true;
dashButton.classList.add('is-cooling');
await new Promise((resolve) => setTimeout(resolve, 130));
assert.equal(finalButton.dataset.motionState, 'locked', 'native disabled state must become the iron socket lock state');
assert.equal(dashButton.dataset.motionState, 'cooling', 'native is-cooling state must drive the socket shutter state');
finalButton.disabled = false;
dashButton.classList.remove('is-cooling');
r12window.handLab.player.hp = 210;
await new Promise((resolve) => setTimeout(resolve, 130));
assert.ok(finalButton.classList.contains('bw-unlock-flash'), 'unlocking a native skill must snap its lock open');
assert.ok(dashButton.classList.contains('bw-ready-flash'), 'cooldown completion must flash the socket rim');
assert.ok(r12doc.querySelector('.bw-hero')?.classList.contains('bw-took-hit'), 'a real HP drop must strike the hero chassis once');
r12window.handLab.player.hp = 280;
const minimapCalls = [];
const minimapCanvasEl = r12doc.getElementById('bw-minimap-canvas');
Object.defineProperty(minimapCanvasEl, 'clientWidth', { configurable: true, get: () => 160 });
minimapCanvasEl.getContext = () => ({
  setTransform() {}, clearRect() { minimapCalls.push('clear'); },
  createRadialGradient() { return { addColorStop() {} }; },
  createLinearGradient() { minimapCalls.push('glass'); return { addColorStop() {} }; },
  beginPath() {}, arc() { minimapCalls.push('arc'); }, fill() {}, fillRect() { minimapCalls.push('glass-fill'); }, save() {}, clip() {}, stroke() {},
  moveTo() {}, lineTo() { minimapCalls.push('viewport-corner'); }, closePath() {},
  translate() {}, rotate() {}, restore() {}, fillText(text) { minimapCalls.push(text); },
});
assert.equal(r12doc.getElementById('bw-pause-menu')?.hidden, true);
r12doc.getElementById('resume-wave')?.click();
assert.ok(pauseCalls > 0 && r12window.handLab.paused, 'pause symbol must pause through the pilot API');
assert.equal(r12doc.getElementById('bw-pause-menu')?.hidden, false, 'pause symbol must open Ring Command');
assert.match(r12doc.getElementById('bw-pause-summary')?.textContent || '', /WAVE 09 · CLUSTER 01 · LV 3/);
assert.ok([...r12doc.querySelectorAll('.bw-pause-chip')].some((chip) => chip.textContent.includes('POWER ×2')), 'pause menu must expose the live build');
assert.ok([...r12doc.querySelectorAll('.bw-pause-chip')].some((chip) => chip.dataset.cardId === 'jab' && chip.dataset.code === 'JB'), 'pause build chips must carry card emblem codes');
const restartButton = r12doc.querySelector('[data-pause-action="restart-run"]');
restartButton?.click();
assert.equal(restartRunCalls, 0, 'destructive restart requires a second confirming press');
assert.ok(restartButton?.classList.contains('is-confirming'));
restartButton?.click();
assert.equal(restartRunCalls, 1, 'second press executes restart through the pilot API');
assert.equal(r12doc.getElementById('bw-pause-menu')?.hidden, true);
r12window.APEX_BOT_WAVE_INTERFACE_V2.openPauseMenu();
r12doc.querySelector('[data-pause-action="save-exit"]')?.click();
assert.equal(saveExitCalls, 1, 'save and exit must use the snapshot-boundary pilot seam');
r12doc.querySelector('[data-pause-action="resume"]')?.click();
assert.equal(r12window.handLab.paused, false);
r12state.phase = 'intermission';
r12state.autoNextWave = true;
r12state.nextWaveT = 2;
r12state.queue = [];
r12window.handLab.enemies = [];
await new Promise((resolve) => setTimeout(resolve, 130));
assert.equal(r12window.BOXE_ARENA_EXPERIENCE.stage.base, null, 'loaded Vietnamese faces must invalidate the prerendered arena type');
assert.equal(r12doc.getElementById('bw-interface-v2')?.dataset.focus, 'breather');
assert.ok(r12doc.getElementById('bw-oracle')?.classList.contains('is-open'), 'oracle opens only in the seamless breather');
assert.ok(minimapCalls.includes('clear') && minimapCalls.includes('viewport-corner') && minimapCalls.includes('glass-fill') && minimapCalls.includes('N'),
  'astrolabe minimap must draw the arena, bracket viewport, glass light and compass from live telemetry');
assert.match(r12doc.getElementById('bw-oracle-title')?.textContent || '', /WAVE 10 · LAST BELL/);
assert.match(r12doc.getElementById('bw-oracle-families')?.textContent || '', /NEW OMEGA/);
assert.match(r12doc.getElementById('bw-momentum-copy')?.textContent || '', /WAVE SEALED/);
r12state.wave = 19;
r12state.autoNextWave = false;
r12state.phase = 'intermission';
r12state.hudBeatIndex = 9;
await new Promise((resolve) => setTimeout(resolve, 130));
assert.match(r12doc.getElementById('bw-oracle-title')?.textContent || '', /WAVE 20 · LAST BELL/,
  'snapshot intermission stores nextWave-1, so the oracle must forecast state.wave+1');
r12window.dispatchEvent(new r12window.Event('pagehide'));
r12window.close();

assert.ok(app.includes('botWavePresentationV2.css?v=20261019-botwave-hud-r16-final'));
assert.ok(app.includes('botWavePresentationV2.js?v=20261019-botwave-hud-r16-final'));
assert.ok(app.includes('close.hidden=true;'), 'App host return chrome must not cover R16 gameplay');
assert.ok(wrapper.includes('botWavePresentationV2.css?v=20261019-botwave-hud-r16-final'));
assert.ok(wrapper.includes('botWavePresentationV2.js?v=20261019-botwave-hud-r16-final'));
assert.ok(wrapper.includes("event.data?.type==='APEX_BOT_WAVE_EXIT'"), 'standalone wrapper must honor the saved-exit message');
assert.ok(wrapper.includes("document.getElementById('return').hidden=true"), 'standalone return chrome retires once Ironworks Command is installed');

console.log('BOT WAVE HUD flow PASS: R16 Ironworks Command, in-bar procedural fire, relic draft, state-driven action motion, no presentation circle around BOXE, 1.75x Gold lens, seamless waves, hold-K guard');
