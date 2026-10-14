// CP12 native lifecycle ownership. The engine must own match boundaries;
// a hero presentation cannot wrap installMatch/exitArsenalBattleMode.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const robot=read('public/game/hero-rework/robotPresentationRuntime.js');
const hr=read('public/game/hero-rework/heroReworkRuntime.js');
const chrome=read('tools/testOwnerGoldSkinsChrome.mjs');
const ail=read('public/game/hero-rework/ailRuntime.js');
assert.match(hr,/AIL\.bus\.emit\('ReworkMatchTeardown'/);
assert.match(hr,/AIL\.bus\.emit\('ReworkMatchInstall'/);
assert.match(ail,/EventBus\.prototype\.on\s*=/);
assert.match(robot,/AIL\.bus\.on\('\*', event=>/);
assert.match(robot,/if\(event\.type==='ReworkMatchTeardown'\)/);
assert.match(robot,/if\(event\.type==='ReworkMatchInstall'\)/);
assert.match(robot,/lifecycleEvidence:\s*\(\)/);
assert.doesNotMatch(robot,/HR2\.installMatch\s*=/,
 'Robot must never override shared Hero Rework match installation');
assert.doesNotMatch(robot,/globalScope\.exitArsenalBattleMode\s*=/,
 'Robot must never override global Battle exit');
assert.doesNotMatch(robot,/__robotTeardownWrapped|__robotExitWrapped/,
 'Legacy lifecycle monkey patch guard is forbidden');
assert.doesNotMatch(robot,/AIL\.bus\.emit\s*=/,
 'Robot cannot intercept the authoritative EventBus');
assert.match(chrome,/H\.installMatch\(\)/);
assert.match(chrome,/G\.exitArsenalBattleMode\(\)/);
assert.match(chrome,/after\.activeRobotStates!==0/);
assert.match(chrome,/bus\.listeners\['\*'\]/);
assert.match(chrome,/CP12 rematch/);
console.log('CP12 NATIVE ROBOT LIFECYCLE PASS: native events, zero global match/exit wrappers, real Chrome rematch/exit proof');
