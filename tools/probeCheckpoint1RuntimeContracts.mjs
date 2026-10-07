#!/usr/bin/env node
// Checkpoint 1 truth probe — renderer readiness + remount lifecycle contracts.
//
// This is intentionally a RED-ORACLE probe for the exact CP1 baseline.
// It reads shipping source only; it never patches runtime behavior.
//
// A failure here means the destination readiness contract can declare battle
// READY while a hero's canonical renderer is still asynchronously loading, or
// a remounted donor leaves a global listener behind.

import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const bridge = read('public/game/gold/goldProductBridge.js');
const hud = read('public/gold/battle-hud.html');
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
const unmount = bridge.match(/BRIDGE\.unmountBattleHud = function unmountBattleHud[\s\S]*?\n  \};/)?.[0] || '';
const mount = bridge.match(/BRIDGE\.mountBattleHud = function mountBattleHud[\s\S]*?\n  \};/)?.[0] || '';

// Evidence that runtime evaluation and renderer readiness are distinct events.
const magnetAsyncInternal =
  /let ready=false,loadError=null;/.test(magnetGold)
  && /async function loadAssets\(\)/.test(magnetGold)
  && /await Promise\.all\(jobs\);ready=true;/.test(magnetGold)
  && /\nloadAssets\(\);/.test(magnetGold)
  && /if\(!ready\|\|!ctx\|\|!combatant/.test(magnetGold);

const frostAsyncInternal =
  /this\.ready = false;/.test(frostGold)
  && /async load\(\)/.test(frostGold)
  && /await Promise\.all\(LAYERS\.map/.test(frostGold)
  && /this\.ready = true;/.test(frostGold)
  && /const api = g\.APEX_FROST_PRESENTATION = \{ ready: false \};/.test(frostPresentation)
  && /e\.load\(\)\.then\(\(\) =>/.test(frostPresentation);

report.observations.magnetInternalAsyncRenderer = magnetAsyncInternal;
report.observations.frostInternalAsyncRenderer = frostAsyncInternal;

gate('Magnet canonical renderer has an asynchronous post-evaluation READY state',
  magnetAsyncInternal,
  'loadAssets() is fire-and-forget; draw() refuses canonical rendering until ready=true');

gate('Frost canonical renderer has an asynchronous post-evaluation READY state',
  frostAsyncInternal,
  'FrostEngine.load()/presentation ready resolve after runtime script evaluation');

// The actual product barrier must await the renderer owner, not merely fetch
// the same URLs through a parallel asset runtime.
const bridgeWaitsMagnet =
  /APEX_MAGNET_GOLD/.test(prepare)
  && /(ready|inspect|whenReady|awaitReady|loadAssets)/.test(prepare);
const bridgeWaitsFrost =
  /APEX_FROST_PRESENTATION|APEX_FROST_GOLD/.test(prepare)
  && /(ready|inspect|whenReady|awaitReady|load\(\))/.test(prepare);

report.observations.prepareSurfaceAwaitsDeferredRuntime =
  /ensureDeferredRuntimes\('arsenalProduct'\)/.test(prepare);
report.observations.prepareSurfaceAwaitsProductAssetRuntime =
  /assets\.prepare\('battle'/.test(prepare);
report.observations.prepareSurfaceAwaitsHeroAudio =
  /warmMatchHeroAudio/.test(prepare);
report.observations.prepareSurfaceWaitsMagnetCanonicalRenderer = bridgeWaitsMagnet;
report.observations.prepareSurfaceWaitsFrostCanonicalRenderer = bridgeWaitsFrost;

// These are expected to FAIL on d032 if the readiness hole exists.
gate('Battle READY explicitly waits for Magnet canonical renderer READY',
  bridgeWaitsMagnet,
  'productAssetRuntime decode is not the same promise as Magnet Gold Image objects');

gate('Battle READY explicitly waits for Frost canonical renderer READY',
  bridgeWaitsFrost,
  'runtime evaluation / generic asset decode does not await Frost presentation ready');

// Verify why the absence is user-visible rather than merely diagnostic.
gate('Magnet presentation falls back until Gold renderer is ready',
  /if \(!ct \|\| !\(this\.hp > 0\) \|\| !GOLD\.ready\) return previous\.call\(this, ctx\);/.test(magnetPresentation),
  'first visible frames can use the previous renderer');
gate('Frost presentation falls through until presentation ready',
  /if \(isFrostBody\(this\) && this\.hp > 0 && api\.ready\)/.test(frostPresentation)
  && /else \{[\s\S]*?prevDraw\.call\(this, ctx\)/.test(frostPresentation),
  'first visible frames can use the previous renderer');

// Remount lifecycle: mount executes the donor inline IIFE every battle.
// The donor installs an anonymous global message listener every execution.
// If unmount does not remove it, the old donor closure remains retained by
// window. This is a real lifecycle leak even if most stale callbacks happen to
// become no-ops after the current donor applies the requested mode first.
const donorGlobalMessageListener =
  /window\.addEventListener\('message',e=>\{/.test(hud);
const donorExecutedEachMount =
  /inline\.join\('\n;\n'\)/.test(mount)
  && /host\.appendChild\(run\)/.test(mount);
const unmountRemovesMessageListener =
  /removeEventListener\('message'/.test(unmount);

report.observations.donorGlobalMessageListener = donorGlobalMessageListener;
report.observations.donorExecutedEachMount = donorExecutedEachMount;
report.observations.unmountRemovesMessageListener = unmountRemovesMessageListener;

gate('Battle HUD unmount releases donor global message listener',
  !donorGlobalMessageListener || !donorExecutedEachMount || unmountRemovesMessageListener,
  'anonymous window message listener is reinstalled by every donor mount and is not released');

// Guardrail: do not misdiagnose the already-fixed lexical-remount problem.
gate('Donor scripts are isolated in a fresh IIFE per mount',
  /function apexGoldHudMount\(\)/.test(mount)
  && /inline\.join\('\n;\n'\)/.test(mount),
  'rules out the old top-level const redeclaration theory');

console.log(JSON.stringify(report, null, 2));
if (report.failures.length) {
  console.error(`CHECKPOINT 1 RUNTIME CONTRACTS: RED (${report.failures.length} failing invariants)`);
  process.exit(1);
}
console.log('CHECKPOINT 1 RUNTIME CONTRACTS: GREEN');
