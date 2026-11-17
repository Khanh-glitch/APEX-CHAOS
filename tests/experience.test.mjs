import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { GRAPHICS_KEY, GRAPHICS_PROFILES, initialAutoQuality, normalizePreferences, createFrameGovernor, installGraphicsQuality, connectGraphicsFrame } from '../src/game/graphicsQuality.js';
import { applyTransitionPresentation } from '../src/game/transitionPresentation.js';

test('unknown Safari capabilities and mobile start conservatively', () => {
  assert.equal(initialAutoQuality(), 'balanced');
  assert.equal(initialAutoQuality({ memory: 8, cores: 8, coarse: true }), 'balanced');
  assert.equal(initialAutoQuality({ memory: 8, cores: 8 }), 'high');
  assert.equal(initialAutoQuality({ saveData: true, memory: 16, cores: 12 }), 'low');
  assert.equal(initialAutoQuality({ cores: 2 }), 'low');
});

test('invalid persisted preferences fail safely', () => {
  assert.deepEqual(normalizePreferences(null), { quality: 'auto', motion: 'system', clarity: true, showFps: false });
  assert.equal(normalizePreferences({ quality: '__proto__' }).quality, 'auto');
  assert.equal(normalizePreferences({ quality: 'ultra', motion: 'reduced', clarity: false }).clarity, false);
  assert.ok(Object.isFrozen(GRAPHICS_PROFILES.low));
});

function frames(governor, count, ms) {
  const windows = [];
  for (let i = 0; i < count; i++) { const result = governor.sample(ms); if (result) windows.push(result); }
  return windows;
}
test('Auto degrades only after sustained slowness and recovers with hysteresis', () => {
  const governor = createFrameGovernor('high');
  assert.equal(frames(governor, 90, 34).at(-1).quality, 'high');
  assert.equal(frames(governor, 90, 34).at(-1).quality, 'balanced');
  assert.equal(frames(governor, 720, 1000/60).at(-1).quality, 'balanced');
  assert.equal(frames(governor, 190, 1000/60).at(-1).quality, 'high');
  assert.ok(frames(governor, 1200, 1000/120).every(w => w.quality === 'high'));
});
test('loading and background gaps reset the governor instead of penalizing graphics', () => {
  const governor = createFrameGovernor('balanced');
  frames(governor, 90, 34);
  assert.equal(governor.sample(5000), null);
  assert.equal(frames(governor, 90, 34).at(-1).quality, 'balanced');
  governor.reset();
  assert.equal(frames(governor, 180, 1000/60).at(-1)?.quality || 'balanced', 'balanced');
});

function environment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://game.test/html/apex/', pretendToBeVisual: true });
  const listeners = new Set();
  const media = { matches: false, addEventListener: (_, fn) => listeners.add(fn) };
  dom.window.matchMedia = query => query.includes('reduced-motion') ? media : { matches: true };
  return { dom, media, listeners };
}
test('preferences persist, follow system motion changes and tolerate denied storage', () => {
  const { dom, media, listeners } = environment();
  const api = installGraphicsQuality(dom.window);
  assert.equal(installGraphicsQuality(dom.window), api);
  let notifications = 0;
  const stop = api.subscribe(() => notifications++);
  api.update({ quality: 'ultra' });
  assert.equal(JSON.parse(dom.window.localStorage.getItem(GRAPHICS_KEY)).quality, 'ultra');
  media.matches = true; listeners.forEach(fn => fn());
  assert.equal(api.getSnapshot().reducedMotion, true);
  assert.equal(dom.window.document.documentElement.dataset.apexQuality, 'ultra');
  api.reportGpuAvailability(false);
  assert.equal(api.getSnapshot().profile.shader, 'off');
  assert.equal(api.getSnapshot().quality, 'ultra');
  api.reportGpuAvailability(true);
  assert.equal(api.getSnapshot().profile.shader, 'ultra');
  assert.ok(notifications >= 4);
  stop(); dom.window.close();
  const denied = environment();
  Object.defineProperty(denied.dom.window, 'localStorage', { get() { throw new Error('SecurityError'); } });
  assert.doesNotThrow(() => installGraphicsQuality(denied.dom.window).update({ quality: 'low' }));
  denied.dom.window.close();
});
test('explicit quality is never silently changed by low frame rates', () => {
  const { dom } = environment();
  const api = installGraphicsQuality(dom.window);
  api.update({ quality: 'ultra', showFps: true });
  for (let i=0;i<600;i++) api.reportFrame(40);
  assert.equal(api.getSnapshot().quality, 'ultra');
  assert.equal(api.getSnapshot().effective, 'ultra');
  assert.equal(api.getSnapshot().fps, 25);
  dom.window.close();
});

test('body and foreground use the same camera, reduced motion locks all camera movement', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (o,k) => o[k] ?? ((...args) => calls.push([k,...args])) });
  let reduced = false;
  const world = {
    ctx, canvas: { width:1000, height:1000 }, GAME_SIZE:1000, cameraShake:10, cameraZoom:1.1,
    rand: () => 5, drawBackground(){}, drawProjectiles(){}, fighters: [], particles: [], shockwaves: [], floatingTexts: [], arenaFlash:{a:0},
    APEX_GRAPHICS: { getSnapshot: () => ({ reducedMotion: reduced }) },
    APEX_BEYOND_COMBAT: { isFreeBattleEligible: () => true },
    APEX_BEYOND_VFX: { getCameraTransform: (zoom,x,y) => reduced ? {focusX:500,focusY:500,zoom:1,offsetX:0,offsetY:0} : {focusX:520,focusY:480,zoom,offsetX:x,offsetY:y} },
  };
  world.window=world;
  vm.runInNewContext(fs.readFileSync(new URL('../public/game/core/apexArsenalProductRenderHudRuntime.js',import.meta.url),'utf8'), world);
  world.draw();
  assert.deepEqual(JSON.parse(JSON.stringify(world.__apexCameraView)), { focusX:520, focusY:480, zoom:1.1, shakeX:5, shakeY:5 });
  assert.ok(calls.some(c => c[0]==='translate' && c[1]===-520 && c[2]===-480));
  reduced=true; world.draw();
  assert.equal(world.__apexCameraView.zoom,1);
  assert.equal(world.__apexCameraView.shakeX,0);
});

test('WebGL unavailable falls back without clearing or replacing the live canvas', () => {
  let fallback=false, writes=0;
  const live={width:1000,height:1000,getContext(){writes++;return {};}};
  const world={
    document:{getElementById:()=>live,createElement:()=>({getContext:()=>null,addEventListener(){}})},
    gameState:'ARSENAL', localStorage:{getItem:()=>null},addEventListener(){},
    APEX_GRAPHICS:{getSnapshot:()=>({profile:{shader:'ultra',postScale:1}}),reportGpuAvailability:v=>{fallback=!v;}},
  };
  world.window=world;
  vm.runInNewContext(fs.readFileSync(new URL('../public/game/evolution/apexEvolutionShaderCompositor.js',import.meta.url),'utf8'),world);
  assert.doesNotThrow(()=>world.APEX_EVOLUTION_SHADER.stepAndComposite());
  assert.equal(fallback,true);assert.equal(writes,0);
  assert.doesNotThrow(()=>world.APEX_EVOLUTION_SHADER.stepAndComposite());
});

test('loading progress counts real completed work and ignores stale operations', async () => {
  const {beginLoading,getLoadingSnapshot}=await import('../src/game/loadingProgress.js');
  const old=beginLoading('surface',3);old.step();
  const battle=beginLoading('battle',2);
  old.finish();assert.equal(getLoadingSnapshot().busy,true);
  battle.step();assert.equal(getLoadingSnapshot().completed,1);
  battle.fail();assert.equal(getLoadingSnapshot().error,true);
  const retry=beginLoading('battle',1);retry.step();retry.finish();
  assert.equal(getLoadingSnapshot().error,false);assert.equal(getLoadingSnapshot().busy,false);
});

test('BOT WAVE inherits preferences without resizing on FPS-only notifications', () => {
  const {dom}=environment(), frame=dom.window.document.createElement('iframe');
  dom.window.document.body.append(frame);
  const disconnect=connectGraphicsFrame(frame,dom.window);
  let resizes=0;frame.contentWindow.addEventListener('resize',()=>resizes++);
  const api=dom.window.APEX_GRAPHICS;
  api.update({quality:'low',motion:'reduced',showFps:true});
  assert.equal(frame.contentWindow.APEX_GRAPHICS,api);
  assert.equal(frame.contentDocument.documentElement.dataset.apexMotion,'reduced');
  assert.equal(resizes,1);
  for(let i=0;i<200;i++)api.reportFrame(16.7);
  assert.equal(resizes,1);
  disconnect();api.update({quality:'ultra'});assert.equal(resizes,1);
  dom.window.close();
});

test('door respects pixel budget and wall-time animation while preserving reduced-motion cover', () => {
  const {dom}=environment();installGraphicsQuality(dom.window).update({quality:'low'});
  let renders=0, phaseDt=0, fills=0, destroyed=0;
  const engine={W:1920,H:1080,dpr:1,canvas:{width:1920,height:1080},state:'CLOSING',now:1,fxQuality:1,
    resize(){},advancePhase:dt=>{phaseDt=dt;},render:()=>{renders++;},destroy:()=>{destroyed++;},
    ctx:{setTransform(){},clearRect(){},fillRect(){fills++;}}};
  applyTransitionPresentation(engine,dom.window);
  assert.ok(engine.canvas.width*engine.canvas.height<=451000);
  engine.advancePhase(.05,'CLOSING');engine.now=1.3;engine.advancePhase(.05,'CLOSING');
  assert.ok(Math.abs(phaseDt-.3)<.001);
  engine.render();assert.equal(renders,1);assert.equal(engine.fxQuality,.3);
  dom.window.APEX_GRAPHICS.update({motion:'reduced'});engine.render();
  assert.equal(renders,1);assert.equal(fills,1);
  engine.state='DONE';engine.render();assert.equal(fills,1);
  engine.destroy();assert.equal(destroyed,1);dom.window.close();
});
