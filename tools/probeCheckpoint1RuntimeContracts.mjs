#!/usr/bin/env node
// Checkpoint 1 truth probe — renderer readiness + remount lifecycle contracts.
//
// RED on the exact d032 baseline; GREEN only when the product owns explicit
// selected-hero renderer readiness and donor-global teardown.

import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const bridge = read('public/game/gold/goldProductBridge.js');
const hud = read('public/gold/battle-hud.html');
const generator = read('tools/buildGoldCutover.mjs');
const hunterPresentation = read('public/game/hero-rework/hunterPresentationRuntime.js');
const frostGold = read('public/game/hero-rework/frostGoldV1.js');
const frostPresentation = read('public/game/hero-rework/frostPresentationRuntime.js');
const magnetGold = read('public/game/hero-rework/magnetGoldV1.js');
const magnetPresentation = read('public/game/hero-rework/magnetPresentationRuntime.js');

const report = {
  baseline: 'd0328808da80fbfad673ce32c757287490e7ef6f',
  probe: 'checkpoint-1-runtime-contracts',
  passes: [],
  failures: [],
  observations: {},
};

function gate(name, ok, detail = '') {
  (ok ? report.passes : report.failures).push({ name, detail });
}

const prepare = bridge.match(/BRIDGE\.prepareSurface = async function prepareSurface[\s\S]*?\n  \};/)?.[0] || '';
const onBattleLive = bridge.match(/BRIDGE\.onBattleLive = async function onBattleLive[\s\S]*?\n  \};/)?.[0] || '';
const unmount = bridge.match(/BRIDGE\.unmountBattleHud = function unmountBattleHud[\s\S]*?\n  \};/)?.[0] || '';
const rendererHelper = bridge.match(/async function prepareMatchHeroRenderers[\s\S]*?\n  \}/)?.[0] || '';

const magnetAsyncInternal =
  /let ready=false,loadError=null,loadPromise=null;/.test(magnetGold)
  && /function whenReady\(\)/.test(magnetGold)
  && /await Promise\.all\(jobs\)/.test(magnetGold)
  && /if\(!ready\|\|!ctx\|\|!combatant/.test(magnetGold);

const frostAsyncInternal =
  /this\.ready = false;/.test(frostGold)
  && /async load\(\)/.test(frostGold)
  && /let readyPromise = null;/.test(frostPresentation)
  && /api\.whenReady = function whenReady\(\)/.test(frostPresentation);

const hunterAsyncInternal =
  /const readyPromise=G\.load\(\)/.test(hunterPresentation)
  && /api\.whenReady=\(\)=>/.test(hunterPresentation)
  && /if\(api\.ready&&this\.hp>0\)/.test(hunterPresentation);

gate('Hunter exposes canonical presentation READY', hunterAsyncInternal);
gate('Frost exposes pre-match canonical presentation READY', frostAsyncInternal);
gate('Magnet exposes canonical Gold renderer READY', magnetAsyncInternal);

gate('Selected-only renderer barrier covers Hunter/Frost/Magnet',
  /ids\.has\('hunter'\)/.test(rendererHelper)
  && /ids\.has\('frost'\).*ids\.has\('ice'\)/s.test(rendererHelper)
  && /ids\.has\('magnet'\)/.test(rendererHelper)
  && /APEX_HUNTER_PRESENTATION/.test(rendererHelper)
  && /APEX_FROST_PRESENTATION/.test(rendererHelper)
  && /APEX_MAGNET_GOLD/.test(rendererHelper));

gate('Battle surface HOLD waits for selected renderer READY',
  /ensureDeferredRuntimes\('arsenalProduct'\)/.test(prepare)
  && /prepareMatchHeroRenderers\(\.\.\.heroIds\)/.test(prepare)
  && /warmMatchHeroAudio\(\.\.\.heroIds\)/.test(prepare));

gate('Direct battle API waits before publishing selection/start state',
  /prepareMatchHeroRenderers\(p1Shell, p2Shell\)/.test(onBattleLive)
  && onBattleLive.indexOf('prepareMatchHeroRenderers(p1Shell, p2Shell)')
     < onBattleLive.indexOf('window.__apexArsenalSelectionMode'));

gate('Magnet presentation falls back until renderer readiness',
  /!GOLD\.ready\) return previous\.call\(this, ctx\);/.test(magnetPresentation));

gate('Battle bridge calls donor dispose before removing donor DOM',
  /APEX_GOLD_HUD\?\.dispose\?\.\(\)/.test(unmount)
  && unmount.indexOf('APEX_GOLD_HUD?.dispose?.()') < unmount.indexOf("hudHost.textContent = ''"));

gate('Donor owns removable resize observer/listener + RAF',
  /const __apexResizeObserver=new ResizeObserver\(resizeCanvas\)/.test(hud)
  && /removeEventListener\('resize',applyViewport\)/.test(hud)
  && /__apexHudFrame=requestAnimationFrame\(frame\)/.test(hud)
  && /cancelAnimationFrame\(__apexHudFrame\)/.test(hud));

gate('Donor handoff message listener is named and disposable',
  /const onBattleHudMessage=e=>\{/.test(hud)
  && /addEventListener\('message',onBattleHudMessage\)/.test(hud)
  && /removeEventListener\('message',onBattleHudMessage\)/.test(hud));

gate('Generator carries the same disposal laws',
  /HUD-H32/.test(generator) && /HUD-H33/.test(generator)
  && /seam\.dispose=function dispose/.test(generator)
  && /cancelAnimationFrame\(__apexHudFrame\)/.test(generator));

gate('Donor scripts remain isolated in a fresh IIFE per mount',
  /function apexGoldHudMount\(\)/.test(bridge)
  && /inline\.join\('\\n;\\n'\)/.test(bridge));

console.log(JSON.stringify(report, null, 2));
if (report.failures.length) {
  console.error(`CHECKPOINT 1 RUNTIME CONTRACTS: RED (${report.failures.length} failing invariants)`);
  process.exit(1);
}
console.log('CHECKPOINT 1 RUNTIME CONTRACTS: GREEN');
